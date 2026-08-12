import Phaser from 'phaser';
import type { WorldCollision } from '../WorldCollision';
import type { EnemyNavGrid, NavPoint } from './EnemyNavGrid';
import { rollDamage } from './cityThreat';
import {
  canDetectInVision,
  ZOMBIE_VISION_HALF_ANGLE,
  ZOMBIE_VISION_INNER_RATIO,
  ZOMBIE_VISION_RANGE_MULT,
} from './visionCone';

export interface EnemyStats {
  maxHp: number;
  damageMin: number;
  damageMax: number;
  /** 0 periferia → 1 centro (visual). */
  proximity: number;
  /** Elite: 4× força da redondeza. */
  elite?: boolean;
  /** Vem a caminho por causa de barulho. */
  alerted?: boolean;
}

/** Inimigo com HP/dano escalados; visão em cone 90°. */
export class Enemy {
  readonly id: string;
  readonly sprite: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Arc;
  private readonly faceMark: Phaser.GameObjects.Triangle;
  private readonly hpBarBg: Phaser.GameObjects.Rectangle;
  private readonly hpBarFg: Phaser.GameObjects.Rectangle;

  maxHp: number;
  hp: number;
  damageMin: number;
  damageMax: number;
  proximity: number;
  elite = false;
  alerted = false;
  hunting = false;
  inHorde = false;
  radius = 8;
  alive = true;
  speed = 55;
  attackCooldown = 0;
  private readonly attackInterval = 0.9;
  private static readonly SPEED_MULT = 0.6;

  /** Direção para onde olha (radianos). */
  facing = Math.random() * Math.PI * 2;

  private wanderAngle = Math.random() * Math.PI * 2;
  private wanderTimer = 0.5 + Math.random() * 2;
  private wanderPause = 0;
  private navWaypoints: NavPoint[] = [];
  private navWaypointIdx = 0;
  private navReplanLeft = 0;
  private navFailStreak = 0;
  private navStuckTime = 0;
  private chaseNoProgressTime = 0;
  private lastChaseDist = Infinity;

  constructor(
    scene: Phaser.Scene,
    id: string,
    x: number,
    y: number,
    stats: EnemyStats,
  ) {
    this.id = id;
    this.maxHp = stats.maxHp;
    this.hp = stats.maxHp;
    this.damageMin = stats.damageMin;
    this.damageMax = stats.damageMax;
    this.proximity = stats.proximity;
    this.elite = !!stats.elite;
    this.alerted = !!stats.alerted;
    if (this.alerted) this.hunting = true;
    this.speed =
      (28 + stats.proximity * 22) *
      (this.elite ? 1.25 : 1) *
      Enemy.SPEED_MULT;
    this.radius = (6 + stats.proximity * 4) * (this.elite ? 1.45 : 1);
    this.facing = this.wanderAngle;

    const tint = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(0xc97858),
      Phaser.Display.Color.ValueToColor(0x8b1e1e),
      100,
      Math.round(stats.proximity * 100),
    );
    const fill = this.elite
      ? 0x6a1b9a
      : Phaser.Display.Color.GetColor(tint.r, tint.g, tint.b);

    this.body = scene.add.circle(0, 0, this.radius, fill, 1);
    this.body.setStrokeStyle(2, this.elite ? 0xffd700 : 0x3d1111, 1);

    this.faceMark = scene.add.triangle(
      0,
      0,
      0,
      -this.radius * 0.9,
      -3,
      this.radius * 0.15,
      3,
      this.radius * 0.15,
      0xf0f6fc,
      0.9,
    );

    const barW = this.elite ? 26 : 18;
    this.hpBarBg = scene.add.rectangle(
      0,
      -(this.radius + 6),
      barW,
      3,
      0x1a1a1a,
      0.85,
    );
    this.hpBarFg = scene.add.rectangle(
      -barW / 2,
      -(this.radius + 6),
      barW,
      3,
      this.elite ? 0xffd700 : 0xe74c3c,
      1,
    );
    this.hpBarFg.setOrigin(0, 0.5);

    const kids: Phaser.GameObjects.GameObject[] = [
      this.body,
      this.faceMark,
      this.hpBarBg,
      this.hpBarFg,
    ];
    if (this.elite) {
      kids.push(
        scene.add
          .text(0, -(this.radius + 14), 'E', {
            fontFamily: 'Segoe UI, sans-serif',
            fontSize: '10px',
            fontStyle: 'bold',
            color: '#ffd700',
            stroke: '#0d1117',
            strokeThickness: 3,
          })
          .setOrigin(0.5, 1),
      );
    }

    this.sprite = scene.add.container(x, y, kids);
    this.sprite.setDepth(55);
    this.syncFacingVisual();
  }

  get x(): number {
    return this.sprite.x;
  }

  get y(): number {
    return this.sprite.y;
  }

  /** Alcance do cone de visão (1.5× base). */
  get visionRadius(): number {
    const base = (48 + this.proximity * 24) * ZOMBIE_VISION_RANGE_MULT;
    return this.inHorde ? base * 1.2 : base;
  }

  get visionHalfAngle(): number {
    return ZOMBIE_VISION_HALF_ANGLE;
  }

  /** Metade interna do cone (stealth só é detectado aqui). */
  get visionInnerRadius(): number {
    return this.visionRadius * ZOMBIE_VISION_INNER_RATIO;
  }

  get chaseRadius(): number {
    const base = this.alerted
      ? 520 + this.proximity * 80
      : 260 + this.proximity * 60;
    return this.inHorde ? base * 1.25 : base;
  }

  canSee(
    tx: number,
    ty: number,
    targetStealthed = false,
    collision?: WorldCollision | null,
  ): boolean {
    if (
      !canDetectInVision(
        this.x,
        this.y,
        this.facing,
        tx,
        ty,
        this.visionRadius,
        this.visionHalfAngle,
        targetStealthed,
      )
    ) {
      return false;
    }
    if (collision && !collision.hasLineOfSight(this.x, this.y, tx, ty)) {
      return false;
    }
    return true;
  }

  private setFacing(angle: number): void {
    this.facing = angle;
    this.syncFacingVisual();
  }

  private syncFacingVisual(): void {
    // Só o marcador roda; a barra de HP fica direita.
    this.faceMark.setRotation(this.facing + Math.PI / 2);
  }

  startHunt(): void {
    if (!this.alive) return;
    this.hunting = true;
    this.navReplanLeft = 0;
  }

  private giveUpHunt(): void {
    this.hunting = false;
    this.alerted = false;
    this.navWaypoints = [];
    this.navWaypointIdx = 0;
    this.navFailStreak = 0;
    this.navStuckTime = 0;
    this.chaseNoProgressTime = 0;
    this.lastChaseDist = Infinity;
    this.navReplanLeft = 0.4 + Math.random() * 1.2;
    this.wanderAngle = Math.random() * Math.PI * 2;
    this.wanderTimer = 0.6 + Math.random() * 1.4;
    this.wanderPause = 0;
  }

  private clearNavPath(): void {
    this.navWaypoints = [];
    this.navWaypointIdx = 0;
  }

  private planNavPath(nav: EnemyNavGrid, targetX: number, targetY: number): boolean {
    const path = nav.findPath(this.x, this.y, targetX, targetY);
    if (path === null) {
      this.navFailStreak += 1;
      this.clearNavPath();
      return false;
    }
    this.navWaypoints = path;
    this.navWaypointIdx = 0;
    this.navFailStreak = 0;
    this.navStuckTime = 0;
    this.navReplanLeft = 0.45 + Math.random() * 0.35;
    return true;
  }

  private currentNavTarget(): NavPoint | null {
    while (
      this.navWaypointIdx < this.navWaypoints.length - 1 &&
      Math.hypot(
        this.x - this.navWaypoints[this.navWaypointIdx]!.x,
        this.y - this.navWaypoints[this.navWaypointIdx]!.y,
      ) < this.cellReachDist()
    ) {
      this.navWaypointIdx += 1;
    }
    return this.navWaypoints[this.navWaypointIdx] ?? null;
  }

  private cellReachDist(): number {
    return 14;
  }

  private handleWanderBlocked(): void {
    this.wanderAngle = Math.random() * Math.PI * 2;
    this.wanderTimer = 0.4 + Math.random() * 1.2;
    this.setFacing(this.wanderAngle);
  }

  setHorde(active: boolean): void {
    this.inHorde = active;
  }

  syncVisibility(): void {
    this.sprite.setVisible(this.alive);
  }

  takeDamage(amount: number): boolean {
    if (!this.alive) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.syncHpBar();
    if (this.hp <= 0) {
      this.alive = false;
      this.hunting = false;
      this.inHorde = false;
      this.sprite.setAlpha(0.35);
      this.body.setFillStyle(0x5a3030, 1);
      return true;
    }
    this.startHunt();
    const prev = this.body.fillColor;
    this.body.setFillStyle(0xffaaaa, 1);
    this.sprite.scene.time.delayedCall(60, () => {
      if (this.alive) this.body.setFillStyle(prev, 1);
    });
    return false;
  }

  updateAI(
    deltaMs: number,
    playerX: number,
    playerY: number,
    playerRadius: number,
    worldW: number,
    worldH: number,
    collision?: WorldCollision | null,
    playerStealthed = false,
  ): number {
    if (!this.alive) return 0;
    const dt = deltaMs / 1000;
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);

    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.hypot(dx, dy) || 1;

    if (!this.hunting && this.canSee(playerX, playerY, playerStealthed, collision)) {
      this.startHunt();
    }

    const chasing = this.hunting || this.alerted;
    let wantX = 0;
    let wantY = 0;
    let moveFacing: number | null = null;
    const nav = collision?.getEnemyNavGrid(worldW, worldH);

    if (
      chasing &&
      dist > this.radius + playerRadius - 1 &&
      dist < this.chaseRadius
    ) {
      const chaseMult =
        (this.alerted ? 1.5 : 1.35) * (this.inHorde ? 1.28 : 1);
      const step = this.speed * chaseMult * dt;
      const hasLos =
        collision?.hasLineOfSight(
          this.x,
          this.y,
          playerX,
          playerY,
          playerRadius,
        ) ?? false;
      const seesPlayer = this.canSee(
        playerX,
        playerY,
        playerStealthed,
        collision,
      );

      if (dist < this.lastChaseDist - 0.8) {
        this.chaseNoProgressTime = 0;
        this.navStuckTime = Math.max(0, this.navStuckTime - dt);
      } else {
        this.chaseNoProgressTime += dt;
      }
      this.lastChaseDist = dist;

      this.navReplanLeft -= dt;
      const needPath =
        nav &&
        !hasLos &&
        (this.navWaypoints.length === 0 ||
          this.navReplanLeft <= 0 ||
          this.navStuckTime > 0.35);

      if (needPath) {
        this.planNavPath(nav, playerX, playerY);
      } else if (hasLos) {
        this.clearNavPath();
        this.navFailStreak = 0;
      }

      let targetX = playerX;
      let targetY = playerY;
      const waypoint = this.currentNavTarget();
      if (waypoint && !hasLos) {
        targetX = waypoint.x;
        targetY = waypoint.y;
      }

      const tdx = targetX - this.x;
      const tdy = targetY - this.y;
      const tdist = Math.hypot(tdx, tdy) || 1;
      if (tdist > 0.5) {
        wantX = (tdx / tdist) * step;
        wantY = (tdy / tdist) * step;
        moveFacing = Math.atan2(tdy, tdx);
      } else {
        moveFacing = Math.atan2(dy, dx);
      }

      if (
        !hasLos &&
        !seesPlayer &&
        this.navFailStreak >= 3 &&
        this.chaseNoProgressTime > 2.4
      ) {
        this.giveUpHunt();
      }
    } else if (!chasing) {
      this.clearNavPath();
      this.navFailStreak = 0;
      this.navStuckTime = 0;
      this.chaseNoProgressTime = 0;
      this.lastChaseDist = Infinity;
      this.stepWander(dt);
      if (this.wanderPause <= 0) {
        const step = this.speed * dt;
        wantX = Math.cos(this.wanderAngle) * step;
        wantY = Math.sin(this.wanderAngle) * step;
        moveFacing = this.wanderAngle;
      }
    } else if (chasing) {
      this.clearNavPath();
    }

    if (wantX !== 0 || wantY !== 0) {
      if (collision) {
        const moved = collision.tryMove(
          this.x,
          this.y,
          wantX,
          wantY,
          this.radius,
          worldW,
          worldH,
        );
        const planned = Math.hypot(wantX, wantY);
        const blocked = moved.moved < planned * 0.25;
        if (blocked) {
          if (chasing) {
            this.navStuckTime += dt;
            const los =
              collision.hasLineOfSight(
                this.x,
                this.y,
                playerX,
                playerY,
                playerRadius,
              );
            if (this.navStuckTime > 0.55) {
              this.navReplanLeft = 0;
            }
            if (
              !los &&
              this.navStuckTime > 2.2 &&
              this.chaseNoProgressTime > 2.0
            ) {
              this.giveUpHunt();
            }
          } else {
            this.handleWanderBlocked();
            moveFacing = this.wanderAngle;
          }
        } else {
          this.navStuckTime = Math.max(0, this.navStuckTime - dt * 0.5);
        }
        this.sprite.x = moved.x;
        this.sprite.y = moved.y;
      } else {
        this.sprite.x = Phaser.Math.Clamp(this.x + wantX, 0, worldW);
        this.sprite.y = Phaser.Math.Clamp(this.y + wantY, 0, worldH);
      }
    }

    if (moveFacing != null) {
      this.setFacing(moveFacing);
    } else if (chasing && dist > this.radius + playerRadius) {
      this.setFacing(Math.atan2(dy, dx));
    }

    const touch = Math.hypot(playerX - this.x, playerY - this.y);
    if (touch <= this.radius + playerRadius + 1 && this.attackCooldown <= 0) {
      this.attackCooldown = this.attackInterval;
      this.startHunt();
      this.setFacing(Math.atan2(dy, dx));
      return rollDamage(this.damageMin, this.damageMax);
    }
    return 0;
  }

  private stepWander(dt: number): void {
    if (this.wanderPause > 0) {
      this.wanderPause -= dt;
      if (this.wanderPause <= 0) {
        this.wanderAngle = Math.random() * Math.PI * 2;
        this.wanderTimer = 1.2 + Math.random() * 2.5;
      }
      return;
    }
    this.wanderTimer -= dt;
    if (this.wanderTimer > 0) return;
    this.wanderPause = 0.35 + Math.random() * 0.9;
  }

  private syncHpBar(): void {
    const ratio = this.hp / this.maxHp;
    const barW = this.elite ? 26 : 18;
    this.hpBarFg.width = barW * ratio;
  }

  destroy(): void {
    this.sprite.destroy(true);
  }
}
