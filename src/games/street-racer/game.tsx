"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import Phaser from "phaser";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store";

// ─── Phaser-Szene: Street Racer ────────────────────────────────

class StreetRacerScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Container;
  private enemyCars: Phaser.GameObjects.Container[] = [];
  private roadMarkings: Phaser.GameObjects.Rectangle[] = [];
  private scoreText!: Phaser.GameObjects.Text;
  private speedText!: Phaser.GameObjects.Text;
  private score = 0;
  private distance = 0;
  private alive = true;
  private speed = 300; // px/s Grundgeschwindigkeit (≈105 km/h)
  private baseMinSpeed = 250; // px/s — steigt alle 1000 m um ~29 px/s (+10 km/h)
  private playerSpeed = 250; // px/s Seitwärts
  private roadScrollSpeed = 0;
  private nextCheckpoint = 1000; // nächste 1000-m-Marke in Metern
  private checkpointLines: Phaser.GameObjects.Rectangle[] = [];
  private onGameOverCallback?: (score: number) => void;
  private countdownValue = 5;
  private countdownActive = true;
  private countdownText!: Phaser.GameObjects.Text;

  // Straßen-Begrenzungen
  private roadLeft = 80;
  private roadRight = 320;
  private readonly CAR_WIDTH = 40;
  private readonly CAR_HEIGHT = 70;

  // Input-Status
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private touchLeft = false;
  private touchRight = false;
  private touchUp = false;
  private touchDown = false;

  // Touch-Zonen
  private leftZone!: Phaser.GameObjects.Zone;
  private rightZone!: Phaser.GameObjects.Zone;
  private upZone!: Phaser.GameObjects.Zone;
  private downZone!: Phaser.GameObjects.Zone;

  constructor() {
    super({ key: "StreetRacerScene" });
  }

  init(data: { onGameOver?: (score: number) => void }) {
    this.onGameOverCallback = data.onGameOver;
  }

  create() {
    this.score = 0;
    this.distance = 0;
    this.alive = true;
    this.speed = 300;
    this.enemyCars = [];
    this.roadMarkings = [];
    this.touchLeft = false;
    this.touchRight = false;
    this.touchUp = false;
    this.touchDown = false;

    const { width, height } = this.scale;
    this.roadLeft = width * 0.2;
    this.roadRight = width * 0.8;
    this.roadScrollSpeed = this.speed;

    // ─── Hintergrund: Gras ──────────────────────────────────
    this.cameras.main.setBackgroundColor("#1a3a1a");

    // ─── Straße ──────────────────────────────────────────────
    const roadGfx = this.add.graphics();
    roadGfx.fillStyle(0x333333, 1);
    roadGfx.fillRect(this.roadLeft, 0, this.roadRight - this.roadLeft, height);
    // Randstreifen
    roadGfx.fillStyle(0xffffff, 0.6);
    roadGfx.fillRect(this.roadLeft - 3, 0, 6, height);
    roadGfx.fillRect(this.roadRight - 3, 0, 6, height);
    roadGfx.setDepth(0);

    // ─── Mittelstreifen ─────────────────────────────────────
    for (let y = 0; y < height + 80; y += 80) {
      const mark = this.add.rectangle(
        (this.roadLeft + this.roadRight) / 2,
        y,
        6,
        40,
        0xffffff,
        0.7
      );
      mark.setDepth(1);
      this.roadMarkings.push(mark);
    }

    // ─── Spieler-Auto zeichnen ──────────────────────────────
    this.player = this.drawCar(
      (this.roadLeft + this.roadRight) / 2,
      height - 100,
      0xe63946, // Rot
      0xfca5a5  // Highlight
    );
    this.player.setDepth(3);

    // ─── Score & Speed ──────────────────────────────────────
    this.scoreText = this.add.text(width / 2, 16, "0 m", {
      fontSize: "28px",
      color: "#ffffff",
      fontFamily: "monospace",
      stroke: "#000000",
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(5);

    this.speedText = this.add.text(width - 12, 16, "80 km/h", {
      fontSize: "16px",
      color: "#fbbf24",
      fontFamily: "monospace",
      stroke: "#000000",
      strokeThickness: 3,
    }).setOrigin(1, 0).setDepth(5);

    // ─── Keyboard ───────────────────────────────────────────
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keyA = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyW = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyS = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S);

    // ─── Touch-Zonen ────────────────────────────────────────
    this.leftZone = this.add.zone(0, height * 0.3, width * 0.5, height * 0.7).setOrigin(0, 0).setInteractive();
    this.rightZone = this.add.zone(width * 0.5, height * 0.3, width * 0.5, height * 0.7).setOrigin(0, 0).setInteractive();
    this.upZone = this.add.zone(0, 0, width, height * 0.3).setOrigin(0, 0).setInteractive();

    this.leftZone.on("pointerdown", () => { this.touchLeft = true; });
    this.leftZone.on("pointerup", () => { this.touchLeft = false; });
    this.leftZone.on("pointerout", () => { this.touchLeft = false; });
    this.rightZone.on("pointerdown", () => { this.touchRight = true; });
    this.rightZone.on("pointerup", () => { this.touchRight = false; });
    this.rightZone.on("pointerout", () => { this.touchRight = false; });
    this.upZone.on("pointerdown", () => { this.touchUp = true; });
    this.upZone.on("pointerup", () => { this.touchUp = false; });
    this.upZone.on("pointerout", () => { this.touchUp = false; });

    // ─── Countdown ───────────────────────────────────────────
    this.countdownValue = 5;
    this.countdownActive = true;
    this.countdownText = this.add.text(width / 2, height / 2, "5", {
      fontSize: "72px",
      color: "#ffffff",
      fontFamily: "monospace",
      stroke: "#000000",
      strokeThickness: 8,
    }).setOrigin(0.5).setDepth(10);

    this.time.addEvent({
      delay: 1000,
      callback: this.updateCountdown,
      callbackScope: this,
      repeat: 5,
    });

    // ─── Touch-Hinweis-Overlay (verschwindet nach 3s) ──────
    const hintLeft = this.add.text(
      width * 0.25, height * 0.65, "◀",
      { fontSize: "36px", color: "#ffffff" }
    ).setOrigin(0.5).setDepth(10).setAlpha(0.3);
    const hintRight = this.add.text(
      width * 0.75, height * 0.65, "▶",
      { fontSize: "36px", color: "#ffffff" }
    ).setOrigin(0.5).setDepth(10).setAlpha(0.3);
    const hintGas = this.add.text(
      width * 0.5, height * 0.12, "▲ GAS",
      { fontSize: "18px", color: "#fbbf24" }
    ).setOrigin(0.5).setDepth(10).setAlpha(0.4);
    this.time.delayedCall(3000, () => {
      this.tweens.add({ targets: [hintLeft, hintRight, hintGas], alpha: 0, duration: 500 });
    });
  }

  private updateCountdown() {
    this.countdownValue--;
    if (this.countdownValue > 0) {
      this.countdownText.setText(String(this.countdownValue));
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

      // ─── Gegner-Spawn-Timer (jetzt erst starten) ─────────────
      this.time.addEvent({
        delay: Phaser.Math.Between(1000, 2000),
        callback: this.spawnEnemy,
        callbackScope: this,
        loop: false,
      });
    }
  }

  update(_time: number, delta: number) {
    if (!this.alive || this.countdownActive) return;

    const dt = delta / 1000;
    const { width } = this.scale;

    // ─── Input verarbeiten ──────────────────────────────────
    let steerX = 0;

    if (this.cursors.left.isDown || this.keyA.isDown) steerX = -1;
    if (this.cursors.right.isDown || this.keyD.isDown) steerX = 1;

    // Touch override Keyboard
    if (this.touchLeft) steerX = -1;
    if (this.touchRight) steerX = 1;

    // Geschwindigkeit steuern – aber Minimum steigt alle 1000 m
    if (this.cursors.up.isDown || this.keyW.isDown || this.touchUp) {
      this.speed = Math.min(600, this.speed + 200 * dt);
    } else {
      this.speed = Math.max(this.baseMinSpeed, this.speed - 100 * dt);
    }

    // Bremsen (geht unter baseMinSpeed)
    if (this.cursors.down.isDown || this.keyS.isDown) {
      this.speed = Math.max(120, this.speed - 400 * dt);
    }

    // Mindestgeschwindigkeit anpassen: alle 1000 m +10 km/h ≈ +29 px/s
    if (this.distance >= this.nextCheckpoint) {
      this.baseMinSpeed += 29;
      this.nextCheckpoint += 1000;
      this.spawnCheckpointLine();
      // Kurzes "KM X"-Popup
      const km = Math.floor(this.distance / 1000);
      const popup = this.add.text(
        this.scale.width / 2,
        this.scale.height / 2 - 100,
        `KM ${km}`,
        {
          fontSize: "36px",
          color: "#fbbf24",
          fontFamily: "monospace",
          stroke: "#000",
          strokeThickness: 6,
        }
      ).setOrigin(0.5).setDepth(8);
      this.tweens.add({
        targets: popup,
        y: popup.y - 60,
        alpha: 0,
        duration: 1200,
        onComplete: () => popup.destroy(),
      });
    }

    // Aktuelle Road-Scroll-Geschwindigkeit
    this.roadScrollSpeed = this.speed;

    // ─── Spieler bewegen ────────────────────────────────────
    if (steerX !== 0) {
      this.player.x += steerX * this.playerSpeed * dt;
      this.player.x = Phaser.Math.Clamp(
        this.player.x,
        this.roadLeft + this.CAR_WIDTH / 2,
        this.roadRight - this.CAR_WIDTH / 2
      );
    }

    // ─── Straßenmarkierungen scrollen ───────────────────────
    this.roadMarkings.forEach((mark) => {
      mark.y += this.roadScrollSpeed * dt;
      if (mark.y > 600 + 40) {
        mark.y -= Math.ceil((600 + 80) / 80) * 80;
      }
    });
    this.distance += this.roadScrollSpeed * dt;
    this.score = Math.floor(this.distance / 10);
    this.scoreText.setText(`${this.score} m`);

    const kmh = Math.floor(this.roadScrollSpeed * 0.35);
    this.speedText.setText(`${kmh} km/h`);

    // ─── Checkpoint-Linien scrollen ──────────────────────────
    for (let i = this.checkpointLines.length - 1; i >= 0; i--) {
      const line = this.checkpointLines[i];
      line.y += this.roadScrollSpeed * dt;
      if (line.y > this.scale.height + 20) {
        line.destroy();
        this.checkpointLines.splice(i, 1);
      }
    }

    // ─── Gegner bewegen & Kollision ─────────────────────────
    for (let i = this.enemyCars.length - 1; i >= 0; i--) {
      const enemy = this.enemyCars[i];
      enemy.y += this.roadScrollSpeed * dt * 0.7; // Gegner etwas langsamer

      // Kollision
      if (this.checkCollision(this.player, enemy)) {
        this.gameOver();
        return;
      }

      if (enemy.y > 700) {
        enemy.destroy();
        this.enemyCars.splice(i, 1);
      }
    }
  }

  private spawnCheckpointLine() {
    const { width, height } = this.scale;
    const rl = this.roadLeft;
    const rr = this.roadRight;
    // Gelbe Querlinie über die gesamte Straßenbreite
    const line = this.add.rectangle(
      (rl + rr) / 2,
      -8, // spawnet knapp über dem Bildschirm
      rr - rl + 6,
      6,
      0xfbbf24, // Gelb
      0.9
    );
    line.setDepth(1);
    this.checkpointLines.push(line);
  }

  private spawnEnemy() {
    if (!this.alive) return;

    const x = Phaser.Math.Between(
      this.roadLeft + this.CAR_WIDTH / 2 + 5,
      this.roadRight - this.CAR_WIDTH / 2 - 5
    );

    const colors = [
      { body: 0x3b82f6, hl: 0x93c5fd }, // Blau
      { body: 0xf59e0b, hl: 0xfde68a }, // Orange
      { body: 0x10b981, hl: 0x6ee7b7 }, // Grün
      { body: 0x8b5cf6, hl: 0xc4b5fd }, // Violett
      { body: 0xffffff, hl: 0xe5e5e5 }, // Weiß
      { body: 0x1f2937, hl: 0x4b5563 }, // Dunkelgrau
    ];
    const c = Phaser.Utils.Array.GetRandom(colors);

    const enemy = this.drawCar(x, -80, c.body, c.hl);
    enemy.setDepth(2);
    this.enemyCars.push(enemy);

    // Nächster Spawn (schneller bei mehr Speed)
    const nextDelay = Phaser.Math.Between(
      Math.max(600, 1800 - this.speed * 2),
      Math.max(1200, 2500 - this.speed * 2)
    );
    this.time.delayedCall(nextDelay, this.spawnEnemy, undefined, this);
  }

  private drawCar(
    x: number,
    y: number,
    bodyColor: number,
    highlightColor: number
  ): Phaser.GameObjects.Container {
    const g = this.add.graphics();
    const cw = this.CAR_WIDTH;
    const ch = this.CAR_HEIGHT;

    // Schatten
    g.fillStyle(0x000000, 0.3);
    g.fillRoundedRect(-cw / 2 + 3, -ch / 2 + 3, cw, ch, 8);

    // Karosserie
    g.fillStyle(bodyColor, 1);
    g.fillRoundedRect(-cw / 2, -ch / 2, cw, ch, 8);

    // Dach / Highlight
    g.fillStyle(highlightColor, 0.7);
    g.fillRoundedRect(-cw / 2 + 6, -ch / 2 + 10, cw - 12, ch * 0.35, 6);

    // Frontscheibe
    g.fillStyle(0x1e293b, 0.8);
    g.fillRoundedRect(-cw / 2 + 8, -ch / 2 + 6, cw - 16, ch * 0.25, 4);

    // Heckscheibe
    g.fillStyle(0x1e293b, 0.6);
    g.fillRoundedRect(-cw / 2 + 8, ch / 2 - ch * 0.25 - 6, cw - 16, ch * 0.2, 4);

    // Scheinwerfer (vorne = oben, da nach oben fahrend)
    g.fillStyle(0xfef08a, 0.9);
    g.fillCircle(-cw / 2 + 9, -ch / 2 + 4, 4);
    g.fillCircle(cw / 2 - 9, -ch / 2 + 4, 4);

    // Rücklichter (unten = hinten)
    g.fillStyle(0xef4444, 1);
    g.fillCircle(-cw / 2 + 9, ch / 2 - 4, 4);
    g.fillCircle(cw / 2 - 9, ch / 2 - 4, 4);

    // Räder
    g.fillStyle(0x111111, 1);
    g.fillRoundedRect(-cw / 2 - 4, -ch / 2 + 14, 8, 16, 3);
    g.fillRoundedRect(cw / 2 - 4, -ch / 2 + 14, 8, 16, 3);
    g.fillRoundedRect(-cw / 2 - 4, ch / 2 - 30, 8, 16, 3);
    g.fillRoundedRect(cw / 2 - 4, ch / 2 - 30, 8, 16, 3);

    return this.add.container(x, y, [g]);
  }

  private checkCollision(
    a: Phaser.GameObjects.Container,
    b: Phaser.GameObjects.Container
  ): boolean {
    const margin = 10;
    const aw = this.CAR_WIDTH;
    const ah = this.CAR_HEIGHT;
    return (
      a.x + aw / 2 - margin > b.x - aw / 2 + margin &&
      a.x - aw / 2 + margin < b.x + aw / 2 - margin &&
      a.y + ah / 2 - margin > b.y - ah / 2 + margin &&
      a.y - ah / 2 + margin < b.y + ah / 2 - margin
    );
  }

  private gameOver() {
    if (!this.alive) return;
    this.alive = false;

    const { width, height } = this.scale;

    // Crash-Effekt
    const { x, y } = this.player;
    for (let i = 0; i < 10; i++) {
      const frag = this.add.rectangle(
        x + Phaser.Math.Between(-20, 20),
        y + Phaser.Math.Between(-30, 30),
        Phaser.Math.Between(3, 8),
        Phaser.Math.Between(3, 8),
        Phaser.Math.Between(0, 1) === 0 ? 0xe63946 : 0x3b82f6
      );
      frag.setDepth(5);
      this.tweens.add({
        targets: frag,
        x: frag.x + Phaser.Math.Between(-50, 50),
        y: frag.y - Phaser.Math.Between(20, 80),
        alpha: 0,
        rotation: Phaser.Math.FloatBetween(-2, 2),
        duration: 500,
        onComplete: () => frag.destroy(),
      });
    }
    // Rote Blende
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0xff0000, 0);
    overlay.setDepth(6);
    this.tweens.add({ targets: overlay, alpha: 0.25, duration: 200, yoyo: true, repeat: 1 });

    // Game-Over-Text
    this.add.text(width / 2, height / 2 - 40, "CRASH!", {
      fontSize: "44px",
      color: "#ef4444",
      fontFamily: "monospace",
      stroke: "#000",
      strokeThickness: 6,
    }).setOrigin(0.5).setDepth(7);

    this.add.text(width / 2, height / 2 + 15, `Distanz: ${this.score} m`, {
      fontSize: "22px",
      color: "#fbbf24",
      fontFamily: "monospace",
      stroke: "#000",
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(7);

    this.add.text(width / 2, height / 2 + 55, "Tippe zum Neustart", {
      fontSize: "15px",
      color: "#9ca3af",
      fontFamily: "monospace",
    }).setOrigin(0.5).setDepth(7);

    this.time.delayedCall(400, () => {
      this.input.once("pointerdown", () => {
        this.scene.restart({ onGameOver: this.onGameOverCallback });
      });
    });

    this.onGameOverCallback?.(this.score);
  }
}

// ─── React Wrapper ─────────────────────────────────────────────

export function StreetRacerGame() {
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
      if (score > highscore) setHighscore(score);

      if (user && score > 0) {
        setSubmitting(true);
        const supabase = createClient();
        await supabase.from("highscores").insert({
          user_id: user.id,
          game_slug: "street-racer",
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
      height: 650,
      parent: containerRef.current,
      backgroundColor: "#1a3a1a",
      scene: StreetRacerScene,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      banner: false,
    };

    gameRef.current = new Phaser.Game(config);
    gameRef.current.events.once("ready", () => {
      gameRef.current?.scene.start("StreetRacerScene", { onGameOver: handleGameOver });
    });

    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, [handleGameOver]);

  useEffect(() => {
    if (gameRef.current) {
      const scene = gameRef.current.scene.getScene("StreetRacerScene") as StreetRacerScene | null;
      if (scene) {
        scene.scene.restart({ onGameOver: handleGameOver });
      }
    }
  }, [handleGameOver]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full max-w-[400px] items-center justify-between rounded-xl bg-gray-900 px-4 py-3 border border-gray-800">
        <div>
          <p className="text-xs text-gray-500 uppercase">Letzte Distanz</p>
          <p className="text-2xl font-bold tabular-nums">{lastScore} m</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 uppercase">Highscore</p>
          <p className="text-2xl font-bold text-yellow-400 tabular-nums">{highscore} m</p>
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

      <div className="text-xs text-gray-500 space-y-1 text-center">
        <p>◀ Linke Hälfte = Lenken &nbsp;|&nbsp; Rechte Hälfte = Lenken</p>
        <p>▲ Oben = Gas geben &nbsp;|&nbsp; ▼ Taste = Bremsen</p>
        <p className="text-gray-600">Tastatur: ← → Lenken · ↑ Gas · ↓ Bremse</p>
      </div>
    </div>
  );
}