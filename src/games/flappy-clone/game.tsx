"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import Phaser from "phaser";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store";

// ─── Phaser-Szene (Space Theme) ─────────────────────────────────

class FlappyScene extends Phaser.Scene {
  private rocket!: Phaser.GameObjects.Container;
  private rocketBody!: Phaser.GameObjects.Graphics;
  private thrusterParticles: Phaser.GameObjects.Rectangle[] = [];
  private asteroids!: Phaser.GameObjects.Group;
  private stars: Phaser.GameObjects.Arc[] = [];
  private scoreText!: Phaser.GameObjects.Text;
  private score = 0;
  private alive = true;
  private onGameOverCallback?: (score: number) => void;
  private countdownValue = 5;
  private countdownActive = true;
  private countdownText!: Phaser.GameObjects.Text;

  private readonly GAP = 170;
  private readonly ASTEROID_WIDTH = 60;
  private readonly ROCKET_WIDTH = 48;
  private readonly ROCKET_HEIGHT = 28;
  private readonly GRAVITY = 700;
  private readonly JUMP_VELOCITY = -300;
  private readonly ASTEROID_SPEED = -180;
  private thrusterTimer = 0;

  constructor() {
    super({ key: "FlappyScene" });
  }

  init(data: { onGameOver?: (score: number) => void }) {
    this.onGameOverCallback = data.onGameOver;
  }

  create() {
    this.score = 0;
    this.alive = true;
    this.thrusterParticles = [];
    this.stars = [];

    const { width, height } = this.scale;

    // ─── Hintergrund: Sternenfeld ──────────────────────────────
    this.cameras.main.setBackgroundColor("#0a0a1a");

    for (let i = 0; i < 80; i++) {
      const star = this.add.circle(
        Phaser.Math.Between(0, width),
        Phaser.Math.Between(0, height),
        Phaser.Math.Between(1, 3),
        0xffffff,
        Phaser.Math.FloatBetween(0.2, 0.9)
      );
      star.setDepth(0);
      this.stars.push(star);
    }

    // 2 ferne Planeten als Dekoration
    this.add.circle(width * 0.8, 80, 18, 0x4f46e5, 0.3).setDepth(0);
    this.add.circle(width * 0.15, height - 60, 24, 0x7c3aed, 0.25).setDepth(0);

    // ─── Rakete bauen ────────────────────────────────────────
    const gfx = this.add.graphics();
    // Rumpf (spitz zulaufend nach rechts)
    gfx.fillStyle(0xe0e7ff, 1);
    gfx.beginPath();
    gfx.moveTo(this.ROCKET_HEIGHT, 0);               // Nase (rechts)
    gfx.lineTo(-this.ROCKET_HEIGHT, -this.ROCKET_HEIGHT / 2); // oben hinten
    gfx.lineTo(-this.ROCKET_HEIGHT * 0.7, 0);          // einbuchtung unten
    gfx.lineTo(-this.ROCKET_HEIGHT, this.ROCKET_HEIGHT / 2);  // unten hinten
    gfx.closePath();
    gfx.fillPath();
    // Fenster
    gfx.fillStyle(0x6366f1, 1);
    gfx.fillCircle(this.ROCKET_HEIGHT * 0.25, 0, 6);
    gfx.fillStyle(0xa5b4fc, 1);
    gfx.fillCircle(this.ROCKET_HEIGHT * 0.25, -1, 3);
    // Flügel
    gfx.fillStyle(0xef4444, 1);
    gfx.fillTriangle(
      -this.ROCKET_HEIGHT * 0.4, -this.ROCKET_HEIGHT / 2,
      -this.ROCKET_HEIGHT * 0.4, this.ROCKET_HEIGHT / 2,
      this.ROCKET_HEIGHT * 0.1, 0
    );
    gfx.setDepth(2);
    this.rocketBody = gfx;

    this.rocket = this.add.container(width * 0.22, height / 2, [gfx]);
    this.rocket.setDepth(2);

    // Physik-Daten
    this.rocket.setData("velocityY", 0);
    this.rocket.setData("width", this.ROCKET_WIDTH);
    this.rocket.setData("height", this.ROCKET_HEIGHT);

    // ─── Asteroiden ──────────────────────────────────────────
    this.asteroids = this.add.group();

    // ─── Score ───────────────────────────────────────────────
    this.scoreText = this.add.text(width / 2, 45, "0", {
      fontSize: "52px",
      color: "#c7d2fe",
      fontFamily: "monospace",
      stroke: "#000000",
      strokeThickness: 6,
    });
    this.scoreText.setOrigin(0.5);
    this.scoreText.setDepth(5);

    // ─── Input ───────────────────────────────────────────────
    this.input.on("pointerdown", () => this.jump());
    this.input.keyboard?.on("keydown-SPACE", () => this.jump());

    // ─── Countdown ───────────────────────────────────────────
    this.countdownValue = 5;
    this.countdownActive = true;
    this.countdownText = this.add.text(width / 2, height / 2, "5", {
      fontSize: "72px",
      color: "#ffffff",
      fontFamily: "monospace",
      stroke: "#1e1b4b",
      strokeThickness: 8,
    }).setOrigin(0.5).setDepth(10);

    this.time.addEvent({
      delay: 1000,
      callback: this.updateCountdown,
      callbackScope: this,
      repeat: 5,
    });
  }

  private updateCountdown() {
    this.countdownValue--;
    if (this.countdownValue > 0) {
      this.countdownText.setText(String(this.countdownValue));
      // Pulse-Effekt
      this.tweens.add({
        targets: this.countdownText,
        scaleX: 1.3,
        scaleY: 1.3,
        duration: 150,
        yoyo: true,
      });
    } else if (this.countdownValue === 0) {
      this.countdownText.setText("GO!");
      this.countdownText.setColor("#4ade80");
      this.tweens.add({
        targets: this.countdownText,
        scaleX: 1.5,
        scaleY: 1.5,
        alpha: 0,
        duration: 400,
        onComplete: () => this.countdownText.destroy(),
      });
      this.countdownActive = false;

      // ─── Timer (jetzt erst starten) ─────────────────────────
      this.time.addEvent({
        delay: 1600,
        callback: this.spawnAsteroid,
        callbackScope: this,
        loop: true,
      });
    }
  }

  update(_time: number, delta: number) {
    if (!this.alive || this.countdownActive) return;

    const dt = delta / 1000;
    const { width, height } = this.scale;

    // ─── Sterne wandern (Parallax) ────────────────────────────
    this.stars.forEach((star) => {
      star.x -= 30 * dt * (star.radius / 2);
      if (star.x < -4) {
        star.x = width + 4;
        star.y = Phaser.Math.Between(0, height);
      }
    });

    // ─── Schwerkraft ─────────────────────────────────────────
    let velocityY = this.rocket.getData("velocityY") as number;
    velocityY += this.GRAVITY * dt;
    this.rocket.setData("velocityY", velocityY);
    this.rocket.y += velocityY * dt;

    // Rakete um velocityY rotieren (leicht)
    this.rocket.rotation = Phaser.Math.Clamp(velocityY / 400, -0.5, 0.5);

    // ─── Thruster-Partikel ──────────────────────────────────
    this.thrusterTimer += dt;
    if (this.thrusterTimer > 0.03) {
      this.thrusterTimer = 0;
      const px = this.rocket.x - this.ROCKET_HEIGHT - 4;
      const py = this.rocket.y + Phaser.Math.Between(-4, 4);
      const p = this.add.rectangle(px, py, Phaser.Math.Between(2, 6), Phaser.Math.Between(1, 3), 0xfb923c);
      p.setAlpha(0.8);
      p.setDepth(1);
      this.thrusterParticles.push(p);
    }
    // Partikel bewegen & löschen
    for (let i = this.thrusterParticles.length - 1; i >= 0; i--) {
      const p = this.thrusterParticles[i];
      p.x -= 180 * dt;
      p.alpha -= 1.5 * dt;
      if (p.alpha <= 0 || p.x < -10) {
        p.destroy();
        this.thrusterParticles.splice(i, 1);
      }
    }

    // ─── Deckel / Boden ──────────────────────────────────────
    if (this.rocket.y < -20 || this.rocket.y > height + 20) {
      this.gameOver();
      return;
    }

    // ─── Asteroiden bewegen & Kollision prüfen ───────────────
    const rocketW = this.rocket.getData("width") as number;
    const rocketH = this.rocket.getData("height") as number;
    const toRemove: Phaser.GameObjects.Container[] = [];
    (this.asteroids.getChildren() as Phaser.GameObjects.Container[]).forEach((ast) => {
      ast.x += this.ASTEROID_SPEED * dt;

      // Score
      if (
        ast.getData("scored") === false &&
        ast.getData("isTop") === true &&
        ast.x + this.ASTEROID_WIDTH < this.rocket.x
      ) {
        ast.setData("scored", true);
        this.score += 1;
        this.scoreText.setText(String(this.score));
        // Score-Popup
        const pop = this.add.text(ast.x, ast.y - 40, "+1", {
          fontSize: "24px",
          color: "#fbbf24",
          fontFamily: "monospace",
          stroke: "#000",
          strokeThickness: 4,
        }).setOrigin(0.5).setDepth(5);
        this.tweens.add({
          targets: pop,
          y: pop.y - 40,
          alpha: 0,
          duration: 500,
          onComplete: () => pop.destroy(),
        });
      }

      // Kollision
      if (
        this.rocket.x + rocketW / 2 > ast.x - this.ASTEROID_WIDTH / 2 &&
        this.rocket.x - rocketW / 2 < ast.x + this.ASTEROID_WIDTH / 2 &&
        this.rocket.y + rocketH / 2 > ast.y - ast.getData("height") / 2 &&
        this.rocket.y - rocketH / 2 < ast.y + ast.getData("height") / 2
      ) {
        this.gameOver();
        return;
      }

      if (ast.x < -this.ASTEROID_WIDTH) {
        toRemove.push(ast);
      }
    });
    toRemove.forEach((a) => a.destroy());
  }

  private jump() {
    if (!this.alive) return;
    this.rocket.setData("velocityY", this.JUMP_VELOCITY);

    // Schub-Puff
    const px = this.rocket.x - this.ROCKET_HEIGHT - 8;
    const py = this.rocket.y;
    for (let i = 0; i < 5; i++) {
      const p = this.add.rectangle(
        px + Phaser.Math.Between(-4, 0),
        py + Phaser.Math.Between(-5, 5),
        Phaser.Math.Between(4, 10),
        Phaser.Math.Between(2, 4),
        0xf97316
      );
      p.setDepth(1);
      p.setAlpha(1);
      this.tweens.add({
        targets: p,
        x: p.x - 40,
        alpha: 0,
        duration: 250,
        onComplete: () => p.destroy(),
      });
    }
  }

  private spawnAsteroid() {
    const { width, height } = this.scale;
    const centerY = Phaser.Math.Between(110, height - 110);
    const halfGap = this.GAP / 2;
    const aw = this.ASTEROID_WIDTH;

    // Oberer Asteroid
    const topHeight = centerY - halfGap;
    if (topHeight > 20) {
      const topContainer = this.add.container(width + aw, centerY - halfGap - topHeight / 2);
      this.drawAsteroid(topContainer, 0, 0, aw, topHeight);
      topContainer.setData("scored", false);
      topContainer.setData("isTop", true);
      topContainer.setData("height", topHeight);
      this.asteroids.add(topContainer);
    }

    // Unterer Asteroid
    const bottomHeight = height - (centerY + halfGap);
    if (bottomHeight > 20) {
      const bottomContainer = this.add.container(width + aw, centerY + halfGap + bottomHeight / 2);
      this.drawAsteroid(bottomContainer, 0, 0, aw, bottomHeight);
      bottomContainer.setData("scored", false);
      bottomContainer.setData("isTop", false);
      bottomContainer.setData("height", bottomHeight);
      this.asteroids.add(bottomContainer);
    }
  }

  private drawAsteroid(container: Phaser.GameObjects.Container, cx: number, cy: number, w: number, h: number) {
    const g = this.add.graphics();
    // Braun-grauer Asteroid mit Kratern
    g.fillStyle(0x5c4033, 1);
    g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 8);
    // Highlights
    g.fillStyle(0x7a5c4f, 1);
    g.fillRoundedRect(cx - w / 2 + 4, cy - h / 2 + 4, w - 8, h - 8, 6);
    // Krater
    g.fillStyle(0x3e2723, 0.6);
    for (let i = 0; i < 3; i++) {
      const kx = cx + Phaser.Math.Between(-w / 3, w / 3);
      const ky = cy + Phaser.Math.Between(-h / 3, h / 3);
      const kr = Phaser.Math.Between(3, 7);
      g.fillCircle(kx, ky, kr);
    }
    // Eiskristalle (cyan)
    g.fillStyle(0x22d3ee, 0.4);
    g.fillCircle(cx + Phaser.Math.Between(-w / 3, w / 3), cy + Phaser.Math.Between(-h / 3, h / 3), Phaser.Math.Between(2, 5));
    container.add(g);
  }

  private gameOver() {
    if (!this.alive) return;
    this.alive = false;

    // Explosion
    const { x, y } = this.rocket;
    for (let i = 0; i < 15; i++) {
      const frag = this.add.rectangle(
        x + Phaser.Math.Between(-15, 15),
        y + Phaser.Math.Between(-15, 15),
        Phaser.Math.Between(3, 8),
        Phaser.Math.Between(3, 8),
        Phaser.Math.Between(0, 1) === 0 ? 0xef4444 : 0xf97316
      );
      frag.setDepth(4);
      this.tweens.add({
        targets: frag,
        x: frag.x + Phaser.Math.Between(-60, 60),
        y: frag.y + Phaser.Math.Between(-60, 60),
        alpha: 0,
        rotation: Phaser.Math.FloatBetween(-3, 3),
        duration: 400,
        onComplete: () => frag.destroy(),
      });
    }
    this.rocket.setVisible(false);

    // Game-Over-Text
    this.add.text(this.scale.width / 2, this.scale.height / 2 - 50, "Game Over!", {
      fontSize: "42px",
      color: "#ffffff",
      fontFamily: "monospace",
      stroke: "#1e1b4b",
      strokeThickness: 6,
    }).setOrigin(0.5).setDepth(6);

    this.add.text(this.scale.width / 2, this.scale.height / 2 + 5, "Tippe zum Neustart 🚀", {
      fontSize: "16px",
      color: "#a5b4fc",
      fontFamily: "monospace",
    }).setOrigin(0.5).setDepth(6);

    this.time.delayedCall(300, () => {
      this.input.once("pointerdown", () => {
        this.scene.restart({ onGameOver: this.onGameOverCallback });
      });
    });

    this.onGameOverCallback?.(this.score);
  }
}

// ─── React Wrapper ─────────────────────────────────────────────

export function FlappyRocketGame() {
  const gameRef = useRef<Phaser.Game | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [highscore, setHighscore] = useState(0);
  const [lastScore, setLastScore] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { user } = useAuthStore();

  const handleGameOver = useCallback(
    async (score: number) => {
      setLastScore(score);
      if (score > highscore) {
        setHighscore(score);
      }

      if (user && score > 0) {
        setSubmitting(true);
        const supabase = createClient();
        await supabase.from("highscores").insert({
          user_id: user.id,
          game_slug: "flappy-clone",
          score,
          played_at: new Date().toISOString(),
        });
        setSubmitting(false);
        setSubmitted(true);
      }
    },
    [user, highscore]
  );

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 400,
      height: 600,
      parent: containerRef.current,
      backgroundColor: "#0a0a1a",
      scene: FlappyScene,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      banner: false,
    };

    gameRef.current = new Phaser.Game(config);
    gameRef.current.events.once("ready", () => {
      gameRef.current?.scene.start("FlappyScene", { onGameOver: handleGameOver });
    });

    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, [handleGameOver]);

  useEffect(() => {
    if (gameRef.current) {
      const scene = gameRef.current.scene.getScene("FlappyScene") as FlappyScene | null;
      if (scene) {
        scene.scene.restart({ onGameOver: handleGameOver });
      }
    }
  }, [handleGameOver]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full max-w-[400px] items-center justify-between rounded-xl bg-gray-900 px-4 py-3 border border-gray-800">
        <div>
          <p className="text-xs text-gray-500 uppercase">Letzter Score</p>
          <p className="text-2xl font-bold tabular-nums">{lastScore}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 uppercase">Highscore</p>
          <p className="text-2xl font-bold text-yellow-400 tabular-nums">{highscore}</p>
        </div>
      </div>

      <div
        ref={containerRef}
        className="w-full max-w-[400px] rounded-xl overflow-hidden border border-gray-800 shadow-xl"
      />

      {!user && (
        <p className="text-sm text-gray-500">
          🔒 <a href="/login" className="text-indigo-400 underline">Melde dich an</a>, um deinen Highscore zu speichern!
        </p>
      )}
      {submitting && <p className="text-sm text-gray-400">Speichere Score...</p>}
      {submitted && <p className="text-sm text-green-400">✅ Score gespeichert!</p>}

      <p className="text-xs text-gray-600 mt-2">
        Tippe / Leertaste zum Schub geben 🚀
      </p>
    </div>
  );
}