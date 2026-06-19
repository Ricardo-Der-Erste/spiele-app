"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import Phaser from "phaser";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store";

// ─── Typen ─────────────────────────────────────────────────────

type AlienType = "gruen" | "rot" | "blau" | "gelb" | "lila";
type UfoBonus = "reset" | "double" | "plus5";

type EntityData = {
  type: "alien" | "ufo";
  alive: boolean;
  width: number;
  height: number;
  points: number;
  vx: number;
  vy: number;
  ufoBonus?: UfoBonus;
  ufoScale?: number;
  ufoLabel?: string;
  alienType?: AlienType;
};

interface AlienDef {
  type: AlienType;
  scale: number;
  basePoints: number;
  bodyColor: number;
  bellyColor: number;
  headColor: number;
  antennaColor: number;
  eyeCount: number;
  label: string;
}

const DATA_KEY = "entityData";
const START_TIME = 30;
const ALIEN_BASE_W = 30;
const ALIEN_BASE_H = 40;
const SPEED_BONUS_THRESHOLD = 60;

// ─── 5 deutlich verschiedene Alien-Typen ──────────────────────

const ALIEN_DEFS: AlienDef[] = [
  {
    type: "gruen", scale: 0.9, basePoints: 20,
    bodyColor: 0x4ade80, bellyColor: 0x86efac, headColor: 0x22c55e,
    antennaColor: 0x22d3ee, eyeCount: 2,
    label: "Grünling",
  },
  {
    type: "rot", scale: 0.95, basePoints: 15,
    bodyColor: 0xef4444, bellyColor: 0xfca5a5, headColor: 0xdc2626,
    antennaColor: 0xfbbf24, eyeCount: 3,
    label: "Roter Aggressor",
  },
  {
    type: "blau", scale: 0.75, basePoints: 30,
    bodyColor: 0x3b82f6, bellyColor: 0x93c5fd, headColor: 0x2563eb,
    antennaColor: 0xa5b4fc, eyeCount: 1,
    label: "Blauer Blitz",
  },
  {
    type: "gelb", scale: 0.55, basePoints: 45,
    bodyColor: 0xfacc15, bellyColor: 0xfef08a, headColor: 0xeab308,
    antennaColor: 0xff6b6b, eyeCount: 2,
    label: "Goldener",
  },
  {
    type: "lila", scale: 1.15, basePoints: 10,
    bodyColor: 0xa855f7, bellyColor: 0xc084fc, headColor: 0x9333ea,
    antennaColor: 0x22d3ee, eyeCount: 2,
    label: "Lila Koloss",
  },
];

const UFO_SIZES: [number, UfoBonus, string][] = [
  [0.5, "reset", "klein"],
  [0.8, "double", "mittel"],
  [1.2, "plus5", "groß"],
];

// ─── Phaser-Szene: Alien Invasion ──────────────────────────────

class AlienScene extends Phaser.Scene {
  private entities: Phaser.GameObjects.Container[] = [];
  private scoreText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private diffText!: Phaser.GameObjects.Text;
  private score = 0;
  private timeLeft = START_TIME;
  private alive = true;
  private elapsedTime = 0;
  private difficultyLevel = 1;
  private timerEvent!: Phaser.Time.TimerEvent;
  private spawnTimer!: Phaser.Time.TimerEvent;
  private stars: Phaser.GameObjects.Arc[] = [];
  private crosshair!: Phaser.GameObjects.Container;
  private onGameOverCallback?: (score: number) => void;
  private emergencyUfoSpawned = false;
  private countdownValue = 5;
  private countdownActive = true;
  private countdownText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: "AlienScene" });
  }

  init(data: { onGameOver?: (score: number) => void }) {
    this.onGameOverCallback = data.onGameOver;
  }

  create() {
    this.score = 0;
    this.timeLeft = START_TIME;
    this.alive = true;
    this.entities = [];
    this.stars = [];
    this.elapsedTime = 0;
    this.difficultyLevel = 1;
    this.emergencyUfoSpawned = false;

    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor("#0a0520");

    for (let i = 0; i < 60; i++) {
      const star = this.add.circle(Phaser.Math.Between(0, width), Phaser.Math.Between(0, height), Phaser.Math.Between(1, 2.5), 0xffffff, Phaser.Math.FloatBetween(0.3, 0.9));
      star.setDepth(0);
      this.stars.push(star);
    }

    const groundY = height * 0.75;
    const groundGfx = this.add.graphics();
    groundGfx.fillStyle(0x3b2f2f, 1); groundGfx.fillRect(0, groundY, width, height - groundY);
    groundGfx.fillStyle(0x4a3a3a, 1);
    groundGfx.fillEllipse(width * 0.2, groundY, 160, 50); groundGfx.fillEllipse(width * 0.7, groundY, 200, 55); groundGfx.fillEllipse(width * 0.5, groundY + 10, 180, 40);
    groundGfx.fillStyle(0x2d2020, 0.7);
    groundGfx.fillCircle(width * 0.3, height * 0.88, 15); groundGfx.fillCircle(width * 0.6, height * 0.82, 12); groundGfx.fillCircle(width * 0.8, height * 0.92, 10);
    groundGfx.setDepth(1);

    this.scoreText = this.add.text(12, 12, "Treffer: 0", { fontSize: "22px", color: "#fbbf24", fontFamily: "monospace", stroke: "#000", strokeThickness: 4 }).setDepth(10);
    this.timeText = this.add.text(width - 12, 12, `${START_TIME}s`, { fontSize: "22px", color: "#ffffff", fontFamily: "monospace", stroke: "#000", strokeThickness: 4 }).setOrigin(1, 0).setDepth(10);
    this.diffText = this.add.text(width / 2, 38, "Stufe 1", { fontSize: "14px", color: "#9ca3af", fontFamily: "monospace", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5, 0).setDepth(10);

    const chGfx = this.add.graphics();
    chGfx.lineStyle(2, 0xef4444, 1); chGfx.strokeCircle(0, 0, 14);
    chGfx.lineBetween(-18, 0, -7, 0); chGfx.lineBetween(7, 0, 18, 0);
    chGfx.lineBetween(0, -18, 0, -7); chGfx.lineBetween(0, 7, 0, 18);
    this.crosshair = this.add.container(width / 2, height / 2, [chGfx]);
    this.crosshair.setDepth(15).setVisible(false);

    this.input.on("pointermove", (p: Phaser.Input.Pointer) => { this.crosshair.setPosition(p.x, p.y); });
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (!this.alive) return;
      this.crosshair.setPosition(p.x, p.y); this.crosshair.setVisible(true);
      this.shoot(p.x, p.y);
      this.tweens.add({ targets: this.crosshair, scaleX: 1.4, scaleY: 1.4, duration: 60, yoyo: true });
    });

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

      // ─── Timer und Spawns (jetzt erst starten) ─────────────
      this.timerEvent = this.time.addEvent({ delay: 1000, callback: this.tick, callbackScope: this, loop: true });
      this.spawnTimer = this.time.addEvent({ delay: 800, callback: this.spawnEntity, callbackScope: this, loop: true });
      this.time.delayedCall(200, this.spawnEntity, undefined, this);
      this.time.delayedCall(500, this.spawnEntity, undefined, this);
    }
  }

  // ─── Update: Aliens bewegen ──────────────────────────────

  update(_time: number, delta: number) {
    if (!this.alive || this.countdownActive) return;
    const dt = delta / 1000;
    const groundY = this.scale.height * 0.75;
    for (const entity of this.entities) {
      const ed = entity.getData(DATA_KEY) as EntityData | undefined;
      if (!ed || !ed.alive) continue;
      if (ed.type !== "alien" && ed.type !== "ufo") continue;
      entity.x += ed.vx * dt;
      entity.y += ed.vy * dt;
      const hw = ed.width / 2, hh = ed.height / 2;
      if (entity.x < hw) { entity.x = hw; ed.vx = Math.abs(ed.vx); }
      if (entity.x > this.scale.width - hw) { entity.x = this.scale.width - hw; ed.vx = -Math.abs(ed.vx); }
      if (entity.y < hh) { entity.y = hh; ed.vy = Math.abs(ed.vy); }
      if (entity.y > groundY - hh) { entity.y = groundY - hh; ed.vy = -Math.abs(ed.vy); }
    }
  }

  // ─── Tick: Zeit + Schwierigkeit ─────────────────────────

  private tick() {
    this.timeLeft--;
    this.elapsedTime++;
    this.timeText.setText(`${this.timeLeft}s`);
    if (this.timeLeft <= 5) this.timeText.setColor("#ef4444");
    else this.timeText.setColor("#ffffff");

    // Alle 10s Schwierigkeit erhöhen
    const newDiff = Math.floor(this.elapsedTime / 10) + 1;
    if (newDiff !== this.difficultyLevel) {
      this.difficultyLevel = newDiff;
      this.diffText.setText(`Stufe ${this.difficultyLevel}`);
    }

    // Not-UFO
    if (this.timeLeft <= 10 && !this.emergencyUfoSpawned) {
      this.emergencyUfoSpawned = true;
      if (this.timeLeft <= 4) this.spawnUfo(0.5, "reset", "klein");
      else {
        const [scale, bonus, label] = Phaser.Utils.Array.GetRandom(UFO_SIZES);
        this.spawnUfo(scale, bonus, label);
      }
      this.time.delayedCall(5000, () => { this.emergencyUfoSpawned = false; });
    }

    if (this.timeLeft <= 0) this.gameOver();
  }

  // ─── Spawn-Logik ──────────────────────────────────────────

  private spawnEntity() {
    if (!this.alive) return;
    const ufoChance = this.timeLeft < 15 ? 0.35 : 0.2;
    if (Math.random() < ufoChance) {
      const [scale, bonus, label] = Phaser.Utils.Array.GetRandom(UFO_SIZES);
      this.spawnUfo(scale, bonus, label);
    } else {
      this.spawnAlien();
    }
  }

  // ─── Alien spawnen ──────────────────────────────────────

  private spawnAlien() {
    const { width, height } = this.scale;
    const margin = this.difficultyLevel >= 4 ? 15 : this.difficultyLevel >= 3 ? 25 : 40;
    const groundY = height * 0.75;
    const x = Phaser.Math.Between(margin, width - margin);
    const y = Phaser.Math.Between(margin, groundY - margin);
    if (this.entities.some((e) => Math.abs(e.x - x) < 50)) return;

    // Zufälligen Alien-Typ wählen (Repertoire wächst mit Stufe)
    const defs = this.difficultyLevel >= 4 ? ALIEN_DEFS
      : this.difficultyLevel >= 3 ? ALIEN_DEFS.slice(0, 4)
        : this.difficultyLevel >= 2 ? ALIEN_DEFS.slice(0, 3)
          : ALIEN_DEFS.slice(0, 2);
    const ad = Phaser.Utils.Array.GetRandom(defs);

    const container = this.add.container(x, y);
    container.setDepth(5 - ad.scale * 0.5);

    // Alien-Grafik
    const g = this.add.graphics();
    g.setScale(ad.scale * 0.9); // 10% kleiner
    const bw = ALIEN_BASE_W, bh = ALIEN_BASE_H;

    // Körper
    g.fillStyle(ad.bodyColor, 1); g.fillEllipse(0, 0, bw * 2, bh * 2);
    g.fillStyle(ad.bellyColor, 1); g.fillEllipse(0, 4, bw * 1.3, bh * 1.2);
    // Kopf
    g.fillStyle(ad.headColor, 1); g.fillEllipse(0, -bh + 8, bw * 1.6, bh * 0.8);
    // Augen
    g.fillStyle(0x000000, 1);
    if (ad.eyeCount === 1) {
      g.fillCircle(0, -bh + 8, 7);
      g.fillStyle(0xffffff, 1); g.fillCircle(0, -bh + 6, 3);
    } else if (ad.eyeCount === 3) {
      g.fillCircle(-10, -bh + 10, 5); g.fillCircle(0, -bh + 5, 5); g.fillCircle(10, -bh + 10, 5);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(-9, -bh + 9, 2); g.fillCircle(1, -bh + 4, 2); g.fillCircle(11, -bh + 9, 2);
    } else {
      g.fillCircle(-8, -bh + 8, 6); g.fillCircle(8, -bh + 8, 6);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(-6, -bh + 6, 2.5); g.fillCircle(10, -bh + 6, 2.5);
    }
    // Antennen
    g.lineStyle(2, ad.antennaColor, 1);
    g.lineBetween(-6, -bh - 5, -10, -bh - 18); g.lineBetween(6, -bh - 5, 10, -bh - 18);
    g.fillStyle(ad.antennaColor, 1);
    g.fillCircle(-10, -bh - 18, 3); g.fillCircle(10, -bh - 18, 3);
    // Tentakel-Arme
    g.lineStyle(3, ad.bodyColor, 1);
    g.lineBetween(-bw, -5, -bw - 10, 8); g.lineBetween(bw, -5, bw + 10, 8);

    container.add(g);

    // Je höher die Stufe, desto schneller
    const speedMult = 0.7 + this.difficultyLevel * 0.3;
    const vx = Phaser.Math.Between(-80, 80) * speedMult;
    const vy = Phaser.Math.Between(-60, 60) * speedMult;
    const speed = Math.sqrt(vx * vx + vy * vy);
    const speedBonus = speed >= SPEED_BONUS_THRESHOLD ? 5 : 0;
    const points = ad.basePoints + speedBonus;

    const ed: EntityData = {
      type: "alien", alive: true,
      width: (bw * 2 + 24) * ad.scale * 0.9, height: (bh * 2 + 16) * ad.scale * 0.9,
      points, vx, vy, alienType: ad.type,
    };
    container.setData(DATA_KEY, ed);
    container.setScale(0.3);
    this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 180, ease: "Back.easeOut" });
    this.entities.push(container);

    // Lebensdauer sinkt mit Stufe
    const baseLifetime = Phaser.Math.Between(1000, 2000);
    const lifetime = baseLifetime / speedMult;
    this.time.delayedCall(lifetime, () => {
      const d = container.getData(DATA_KEY) as EntityData | undefined;
      if (!container.active || !d?.alive) return;
      this.despawnEntity(container);
    });
  }

  // ─── UFO spawnen ────────────────────────────────────────

  private spawnUfo(scale: number, bonusType: UfoBonus, label: string) {
    const { width, height } = this.scale;
    const margin = 60;
    const x = Phaser.Math.Between(margin, width - margin);
    const y = Phaser.Math.Between(margin, height * 0.65);
    if (this.entities.some((e) => Math.abs(e.x - x) < 80)) return;

    const container = this.add.container(x, y);
    container.setDepth(5 - scale * 0.4);
    const g = this.add.graphics();
    g.setScale(scale);
    g.fillStyle(0x9ca3af, 1); g.fillEllipse(0, 6, 56, 20);
    g.fillStyle(0xd1d5db, 1); g.fillEllipse(0, 4, 58, 18);
    g.fillStyle(0x67e8f9, 0.7); g.fillEllipse(0, -8, 24, 18);
    g.lineStyle(2, 0xd1d5db, 1); g.strokeEllipse(0, -8, 26, 20);
    const lightColors = [0xfbbf24, 0xef4444, 0x22d3ee, 0xa3e635];
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      g.fillStyle(Phaser.Utils.Array.GetRandom(lightColors), 1);
      g.fillCircle(Math.cos(angle) * 24, Math.sin(angle) * 8 + 6, 2.5);
    }
    g.fillStyle(0x9ca3af, 1); g.fillRect(-1.5, -18, 3, 10); g.fillCircle(0, -20, 3);
    // UFOs bewegen sich ebenfalls – nach gleichen Regeln wie Aliens
    const speedMult = 0.7 + this.difficultyLevel * 0.3;
    const vx = Phaser.Math.Between(-60, 60) * speedMult;
    const vy = Phaser.Math.Between(-40, 40) * speedMult;

    container.add(g);

    const ed: EntityData = {
      type: "ufo", alive: true, width: 64 * scale, height: 36 * scale,
      points: 0, vx, vy, ufoBonus: bonusType, ufoScale: scale, ufoLabel: label,
    };
    container.setData(DATA_KEY, ed);
    container.setScale(0.3);
    this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 250, ease: "Back.easeOut" });
    this.tweens.add({ targets: container, y: y - 4 * scale, duration: 500 + 100 * scale, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    this.entities.push(container);

    const lifetime = label === "klein" ? Phaser.Math.Between(1000, 2000) : label === "mittel" ? Phaser.Math.Between(1400, 2400) : Phaser.Math.Between(1800, 3000);
    this.time.delayedCall(lifetime, () => {
      const d = container.getData(DATA_KEY) as EntityData | undefined;
      if (!container.active || !d?.alive) return;
      this.despawnEntity(container);
    });
  }

  // ─── Schießen ─────────────────────────────────────────────

  private shoot(px: number, py: number) {
    if (!this.alive || this.countdownActive) return;
    const gunX = this.scale.width / 2;
    const gunY = this.scale.height * 0.75;
    const laser = this.add.graphics();
    laser.lineStyle(3, 0xef4444, 1); laser.lineBetween(gunX, gunY, px, py); laser.setDepth(14);
    const flash = this.add.circle(gunX, gunY, 8, 0xfef08a, 0.9); flash.setDepth(14);
    this.tweens.add({ targets: [laser, flash], alpha: 0, duration: 120, onComplete: () => { laser.destroy(); flash.destroy(); } });

    for (let i = this.entities.length - 1; i >= 0; i--) {
      const entity = this.entities[i];
      const ed = entity.getData(DATA_KEY) as EntityData | undefined;
      if (!ed?.alive) continue;
      if (px > entity.x - ed.width / 2 && px < entity.x + ed.width / 2 && py > entity.y - ed.height / 2 && py < entity.y + ed.height / 2) {
        if (ed.type === "alien") this.hitAlien(entity, ed);
        else this.hitUfo(entity, ed);
        return;
      }
    }
  }

  // ─── Alien getroffen ──────────────────────────────────────

  private hitAlien(entity: Phaser.GameObjects.Container, ed: EntityData) {
    ed.alive = false; entity.setData(DATA_KEY, ed);
    this.score += ed.points;
    this.scoreText.setText(`Treffer: ${this.score}`);
    const { x, y } = entity;

    // Explosion in Alien-Farbe
    const ad = ALIEN_DEFS.find((a) => a.type === ed.alienType);
    const color = ad?.bodyColor ?? 0x4ade80;
    for (let i = 0; i < 12; i++) {
      const p = this.add.rectangle(x + Phaser.Math.Between(-20, 20), y + Phaser.Math.Between(-20, 20), Phaser.Math.Between(2, 6), Phaser.Math.Between(2, 6), color);
      p.setDepth(6);
      this.tweens.add({ targets: p, x: p.x + Phaser.Math.Between(-40, 40), y: p.y - Phaser.Math.Between(20, 60), alpha: 0, scaleX: 0.2, scaleY: 0.2, duration: 400, onComplete: () => p.destroy() });
    }

    const isSpeedBonus = ed.vx !== 0 && Math.sqrt(ed.vx * ed.vx + ed.vy * ed.vy) >= SPEED_BONUS_THRESHOLD;
    const popStr = isSpeedBonus ? `+${ed.points} ⚡` : `+${ed.points}`;
    const popColor = ed.points >= 40 ? "#a3e635" : ed.points >= 20 ? "#fbbf24" : "#fde68a";
    const pop = this.add.text(x, y - 30, popStr, { fontSize: ed.points >= 40 ? "28px" : "22px", color: popColor, fontFamily: "monospace", stroke: "#000", strokeThickness: 4 }).setOrigin(0.5).setDepth(8);
    this.tweens.add({ targets: pop, y: pop.y - 50, alpha: 0, duration: 700, onComplete: () => pop.destroy() });
    this.tweens.add({ targets: entity, scaleX: 0, scaleY: 0, alpha: 0, duration: 200, onComplete: () => { entity.destroy(); this.removeEntity(entity); } });
  }

  // ─── UFO getroffen ─────────────────────────────────────

  private hitUfo(entity: Phaser.GameObjects.Container, ed: EntityData) {
    ed.alive = false; entity.setData(DATA_KEY, ed);
    let bonusText = "";
    const bonus = ed.ufoBonus ?? "plus5";

    if (bonus === "reset") { this.timeLeft = START_TIME; bonusText = "⏱ ZURÜCK"; }
    else if (bonus === "double") { this.timeLeft = Math.min(99, this.timeLeft * 2); bonusText = "⏱ x2"; }
    else { this.timeLeft = Math.min(99, this.timeLeft + 5); bonusText = "+5s"; }

    this.timeText.setText(`${this.timeLeft}s`);
    if (this.timeLeft > 5) this.timeText.setColor("#ffffff");

    const { x, y } = entity;
    for (let i = 0; i < 10; i++) {
      const p = this.add.rectangle(x + Phaser.Math.Between(-25, 25), y + Phaser.Math.Between(-15, 15), Phaser.Math.Between(2, 6), Phaser.Math.Between(2, 6), Phaser.Math.Between(0, 1) === 0 ? 0x67e8f9 : 0xd1d5db);
      p.setDepth(6);
      this.tweens.add({ targets: p, x: p.x + Phaser.Math.Between(-40, 40), y: p.y - Phaser.Math.Between(20, 60), alpha: 0, duration: 400, onComplete: () => p.destroy() });
    }
    const pop = this.add.text(x, y - 30, bonusText, { fontSize: "20px", color: "#67e8f9", fontFamily: "monospace", stroke: "#000", strokeThickness: 4 }).setOrigin(0.5).setDepth(8);
    this.tweens.add({ targets: pop, y: pop.y - 50, alpha: 0, duration: 700, onComplete: () => pop.destroy() });
    this.tweens.add({ targets: entity, scaleX: 0, scaleY: 0, alpha: 0, duration: 200, onComplete: () => { entity.destroy(); this.removeEntity(entity); } });
  }

  private removeEntity(entity: Phaser.GameObjects.Container) {
    const idx = this.entities.indexOf(entity);
    if (idx > -1) this.entities.splice(idx, 1);
  }

  private despawnEntity(entity: Phaser.GameObjects.Container) {
    const ed = entity.getData(DATA_KEY) as EntityData | undefined;
    if (!ed?.alive) return;
    ed.alive = false; entity.setData(DATA_KEY, ed);
    this.tweens.add({ targets: entity, y: entity.y + 40, alpha: 0, duration: 300, onComplete: () => { entity.destroy(); this.removeEntity(entity); } });
  }

  private gameOver() {
    if (!this.alive) return;
    this.alive = false;
    this.timerEvent?.remove();
    this.spawnTimer?.remove();
    this.entities.forEach((e) => this.despawnEntity(e));
    this.crosshair.setVisible(false);
    const { width, height } = this.scale;
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0);
    overlay.setDepth(20);
    this.tweens.add({ targets: overlay, alpha: 0.5, duration: 400 });
    this.add.text(width / 2, height / 2 - 50, "Zeit abgelaufen!", { fontSize: "34px", color: "#ffffff", fontFamily: "monospace", stroke: "#000", strokeThickness: 5 }).setOrigin(0.5).setDepth(21);
    this.add.text(width / 2, height / 2 + 5, `Score: ${this.score}`, { fontSize: "20px", color: "#fbbf24", fontFamily: "monospace", stroke: "#000", strokeThickness: 4 }).setOrigin(0.5).setDepth(21);
    this.add.text(width / 2, height / 2 + 45, `Stufe: ${this.difficultyLevel}`, { fontSize: "16px", color: "#9ca3af", fontFamily: "monospace" }).setOrigin(0.5).setDepth(21);
    this.add.text(width / 2, height / 2 + 75, "Tippe zum Neustart", { fontSize: "15px", color: "#9ca3af", fontFamily: "monospace" }).setOrigin(0.5).setDepth(21);
    this.time.delayedCall(500, () => { this.input.once("pointerdown", () => { this.scene.restart({ onGameOver: this.onGameOverCallback }); }); });
    this.onGameOverCallback?.(this.score);
  }
}

// ─── React Wrapper ─────────────────────────────────────────────

export function AlienInvasionGame() {
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
        await supabase.from("highscores").insert({ user_id: user.id, game_slug: "alien-invasion", score, played_at: new Date().toISOString() });
        setSubmitting(false); setSubmitted(true);
      }
    },
    [user, highscore]
  );

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO, width: 400, height: 600, parent: containerRef.current,
      backgroundColor: "#0a0520", scene: AlienScene,
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, banner: false,
    };
    gameRef.current = new Phaser.Game(config);
    gameRef.current.events.once("ready", () => { gameRef.current?.scene.start("AlienScene", { onGameOver: handleGameOver }); });
    return () => { gameRef.current?.destroy(true); gameRef.current = null; };
  }, [handleGameOver]);

  useEffect(() => {
    if (gameRef.current) {
      const scene = gameRef.current.scene.getScene("AlienScene") as AlienScene | null;
      if (scene) { scene.scene.restart({ onGameOver: handleGameOver }); }
    }
  }, [handleGameOver]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full max-w-[400px] items-center justify-between rounded-xl bg-gray-900 px-4 py-3 border border-gray-800">
        <div><p className="text-xs text-gray-500 uppercase">Letzter Score</p><p className="text-2xl font-bold tabular-nums">{lastScore}</p></div>
        <div className="text-right"><p className="text-xs text-gray-500 uppercase">Highscore</p><p className="text-2xl font-bold text-yellow-400 tabular-nums">{highscore}</p></div>
      </div>
      <div ref={containerRef} className="w-full max-w-[400px] rounded-xl overflow-hidden border border-gray-800 shadow-xl" />
      {!user && <p className="text-sm text-gray-500">🔒 <a href="/login" className="text-indigo-400 underline">Melde dich an</a>, um deinen Highscore zu speichern!</p>}
      {submitting && <p className="text-sm text-gray-400">Speichere Score...</p>}
      {submitted && <p className="text-sm text-green-400">✅ Score gespeichert!</p>}
      <div className="text-xs text-gray-500 space-y-1 text-center">
        <p>🟢 Grünling 🔴 Aggressor 🔵 Blitz 🟡 Goldener 🟣 Koloss</p>
        <p>🛸 UFO klein: Reset · Mittel: x2 · Groß: +5s</p>
        <p className="text-gray-600">Schwierigkeit steigt alle 10s ⚡</p>
      </div>
    </div>
  );
}