import Phaser from 'phaser';
import { stableHash01 } from '../../assets/wreckedCars';
import type { WorldCollision } from '../WorldCollision';
import type { EnemyNavGrid, NavPoint } from './EnemyNavGrid';
import {
  resolveZombieMeleeAttack,
  type ZombieMeleeResult,
} from './zombieMeleeAttack';
import {
  canDetectInVision,
  ZOMBIE_VISION_HALF_ANGLE,
  ZOMBIE_VISION_INNER_RATIO,
  ZOMBIE_VISION_RANGE_MULT,
} from './visionCone';
import type { CorpseIndex } from './CorpseIndex';
import {
  CORPSE_EAT_COOLDOWN_SEC,
  CORPSE_EAT_MAX_SEC,
  corpseEatDurationSec,
  corpseEatRadiusPx,
} from './CorpseIndex';

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

/** Inimigo com HP/dano escalados; visão em cone 90°. Sprite lazy perto da câmara. */
export class Enemy {
  readonly id: string;
  sprite: Phaser.GameObjects.Container | null = null;
  private scene: Phaser.Scene | null;
  private body: Phaser.GameObjects.Arc | null = null;
  private faceMark: Phaser.GameObjects.Triangle | null = null;
  private hpBarBg: Phaser.GameObjects.Rectangle | null = null;
  private hpBarFg: Phaser.GameObjects.Rectangle | null = null;

  private _x: number;
  private _y: number;

  maxHp: number;
  hp: number;
  damageMin: number;
  damageMax: number;
  proximity: number;
  elite = false;
  alerted = false;
  hunting = false;
  inHorde = false;
  /** Parado a comer cadáver. */
  eating = false;
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
  private eatingLeftSec = 0;
  private eatingCorpseId: string | null = null;
  private eatingCorpseX = 0;
  private eatingCorpseY = 0;
  private corpseLureId: string | null = null;
  private corpseLureX = 0;
  private corpseLureY = 0;
  /** Tempo até voltar a procurar cadáveres após uma refeição. */
  private corpseEatCooldownLeft = 0;
  private bodyFillBeforeEat: number | null = null;

  /** Segundos restantes de queimadura (1 dmg/s). */
  private burnLeft = 0;
  private burnTick = 0;
  private bodyFillBeforeBurn: number | null = null;

  constructor(
    scene: Phaser.Scene,
    id: string,
    x: number,
    y: number,
    stats: EnemyStats,
  ) {
    this.scene = scene;
    this.id = id;
    this._x = x;
    this._y = y;
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
  }

  get x(): number {
    return this._x;
  }

  get y(): number {
    return this._y;
  }

  get hasVisual(): boolean {
    return this.sprite != null;
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

  /** Cone de detecção — oculto ao caçar/alertar; metade enquanto come. */
  get showVisionCone(): boolean {
    return !this.hunting && !this.alerted;
  }

  /** Overlay/detecção só na metade interna (como jogador agachado). */
  get visionConeInnerOnly(): boolean {
    return this.eating;
  }

  get isEating(): boolean {
    return this.eating;
  }

  get targetCorpseId(): string | null {
    return this.eatingCorpseId;
  }

  get isLuredByCorpse(): boolean {
    return this.corpseLureId != null;
  }

  get isBurning(): boolean {
    return this.burnLeft > 0;
  }

  get chaseRadius(): number {
    const base = this.alerted
      ? 520 + this.proximity * 80
      : 260 + this.proximity * 60;
    return this.inHorde ? base * 1.25 : base;
  }

  ensureVisual(): void {
    if (this.sprite || !this.scene) return;

    const scene = this.scene;
    const stats = {
      proximity: this.proximity,
      elite: this.elite,
    };

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

    this.sprite = scene.add.container(this._x, this._y, kids);
    this.sprite.setDepth(55);
    this.syncFacingVisual();
    this.syncHpBar();
    if (!this.alive) {
      this.sprite.setAlpha(0.35);
      this.body.setFillStyle(0x5a3030, 1);
    }
  }

  releaseVisual(): void {
    if (!this.sprite) return;
    this.sprite.destroy(true);
    this.sprite = null;
    this.body = null;
    this.faceMark = null;
    this.hpBarBg = null;
    this.hpBarFg = null;
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
        targetStealthed || this.eating,
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
    this.faceMark?.setRotation(this.facing + Math.PI / 2);
  }

  startHunt(): void {
    if (!this.alive) return;
    this.stopEating();
    this.clearCorpseLure();
    this.hunting = true;
    this.navReplanLeft = 0;
  }

  startEating(corpseId: string, cx: number, cy: number, durationSec: number): void {
    if (this.hunting || this.alerted || !this.alive) return;
    if (this.corpseEatCooldownLeft > 0) return;
    this.eating = true;
    this.eatingCorpseId = corpseId;
    this.eatingLeftSec = Math.min(durationSec, CORPSE_EAT_MAX_SEC);
    this.eatingCorpseX = cx;
    this.eatingCorpseY = cy;
    this.clearCorpseLure();
    this.clearNavPath();
    this.wanderPause = 0;
    this.wanderTimer = 0.6 + Math.random() * 1.4;
    this.ensureVisual();
    if (this.body) {
      this.bodyFillBeforeEat = this.body.fillColor;
      this.body.setFillStyle(0x7a3a2a, 1);
    }
  }

  stopEating(): void {
    if (!this.eating) return;
    this.eating = false;
    this.eatingLeftSec = 0;
    this.eatingCorpseId = null;
    if (this.body && this.bodyFillBeforeEat != null && this.alive) {
      this.body.setFillStyle(this.bodyFillBeforeEat, 1);
    }
    this.bodyFillBeforeEat = null;
  }

  /** @returns true se continua a comer (sem movimento neste frame). */
  private stepEating(dt: number): boolean {
    if (!this.eating) return false;
    this.eatingLeftSec -= dt;
    this.setFacing(
      Math.atan2(this.eatingCorpseY - this.y, this.eatingCorpseX - this.x),
    );
    if (this.eatingLeftSec <= 0) {
      this.finishEatingMeal();
      this.wanderTimer = 0.4 + Math.random() * 1.2;
    }
    return this.eating;
  }

  private finishEatingMeal(): void {
    this.stopEating();
    this.corpseEatCooldownLeft = CORPSE_EAT_COOLDOWN_SEC;
  }

  private canSeekCorpse(): boolean {
    return this.corpseEatCooldownLeft <= 0 && !this.eating;
  }

  private clearCorpseLure(): void {
    this.corpseLureId = null;
  }

  private setCorpseLure(corpseId: string, cx: number, cy: number): void {
    this.corpseLureId = corpseId;
    this.corpseLureX = cx;
    this.corpseLureY = cy;
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
    return Math.max(14, this.radius + 4);
  }

  /** Pathfind quando não há LOS ou quando encosta num obstáculo (ex.: quina de carro). */
  private shouldPlanNavPath(hasLos: boolean): boolean {
    return (
      !hasLos ||
      this.navStuckTime > 0.2 ||
      (this.navWaypoints.length === 0 && this.navReplanLeft <= 0)
    );
  }

  /** Segue waypoints se não há LOS directo ou se ficou preso com LOS. */
  private shouldFollowNavWaypoint(hasLos: boolean): boolean {
    return !hasLos || this.navStuckTime > 0.12;
  }

  private tryMoveWithSidestep(
    collision: WorldCollision,
    wantX: number,
    wantY: number,
    worldW: number,
    worldH: number,
  ): { x: number; y: number; moved: number; blocked: boolean } {
    const planned = Math.hypot(wantX, wantY);
    let result = collision.tryMove(
      this.x,
      this.y,
      wantX,
      wantY,
      this.radius,
      worldW,
      worldH,
    );
    if (result.moved >= planned * 0.25) {
      return { ...result, blocked: false };
    }

    const base = Math.atan2(wantY, wantX);
    const preferLeft = stableHash01(`${this.id}:sidestep`) > 0.5;
    const offsets = preferLeft
      ? [Math.PI / 2, -Math.PI / 2, (3 * Math.PI) / 4, -(3 * Math.PI) / 4]
      : [-Math.PI / 2, Math.PI / 2, -(3 * Math.PI) / 4, (3 * Math.PI) / 4];

    for (const off of offsets) {
      const a = base + off;
      const sx = Math.cos(a) * planned * 0.85;
      const sy = Math.sin(a) * planned * 0.85;
      const alt = collision.tryMove(
        this.x,
        this.y,
        sx,
        sy,
        this.radius,
        worldW,
        worldH,
      );
      if (alt.moved >= planned * 0.2) {
        return { ...alt, blocked: false };
      }
    }

    return { ...result, blocked: true };
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
    this.sprite?.setVisible(this.alive);
  }

  /** Contacto com fogo: 1 de dano/s durante 3 s (renova). */
  ignite(durationSec = 3): void {
    if (!this.alive) return;
    this.burnLeft = Math.max(this.burnLeft, durationSec);
    this.ensureVisual();
    if (this.body && !this.eating) {
      if (this.bodyFillBeforeBurn == null) {
        this.bodyFillBeforeBurn = this.body.fillColor;
      }
      this.body.setFillStyle(0xff7043, 1);
    }
  }

  updateBurn(deltaMs: number): void {
    if (!this.alive || this.burnLeft <= 0) return;
    const dt = deltaMs / 1000;
    this.burnLeft -= dt;
    this.burnTick += dt;
    while (this.burnTick >= 1) {
      this.burnTick -= 1;
      this.applyBurnDamage(1);
    }
    if (this.burnLeft <= 0) {
      this.burnLeft = 0;
      this.burnTick = 0;
      this.restoreBodyAfterBurn();
    }
  }

  private applyBurnDamage(amount: number): void {
    if (!this.alive || amount <= 0) return;
    this.stopEating();
    this.hp = Math.max(0, this.hp - amount);
    this.ensureVisual();
    this.syncHpBar();
    if (this.hp <= 0) {
      this.alive = false;
      this.hunting = false;
      this.inHorde = false;
      this.burnLeft = 0;
      this.burnTick = 0;
      this.sprite?.setAlpha(0.35);
      this.body?.setFillStyle(0x5a3030, 1);
    }
  }

  private restoreBodyAfterBurn(): void {
    if (!this.body || !this.alive) return;
    if (this.eating) {
      this.body.setFillStyle(0x7a3a2a, 1);
      this.bodyFillBeforeBurn = null;
      return;
    }
    if (this.bodyFillBeforeBurn != null) {
      this.body.setFillStyle(this.bodyFillBeforeBurn, 1);
      this.bodyFillBeforeBurn = null;
    }
  }

  takeDamage(amount: number): boolean {
    if (!this.alive) return false;
    this.stopEating();
    this.hp = Math.max(0, this.hp - amount);
    this.ensureVisual();
    this.syncHpBar();
    if (this.hp <= 0) {
      this.alive = false;
      this.hunting = false;
      this.inHorde = false;
      this.sprite?.setAlpha(0.35);
      this.body?.setFillStyle(0x5a3030, 1);
      return true;
    }
    this.startHunt();
    if (this.body) {
      const prev = this.body.fillColor;
      this.body.setFillStyle(0xffaaaa, 1);
      this.scene?.time.delayedCall(60, () => {
        if (this.alive && this.body) this.body.setFillStyle(prev, 1);
      });
    }
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
    corpseIndex: CorpseIndex | null = null,
    tileSize = 32,
    canEatCorpse: ((corpseId: string) => boolean) | null = null,
  ): ZombieMeleeResult | null {
    if (!this.alive) return null;
    const dt = deltaMs / 1000;
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.corpseEatCooldownLeft = Math.max(0, this.corpseEatCooldownLeft - dt);

    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.hypot(dx, dy) || 1;

    if (!this.hunting && this.canSee(playerX, playerY, playerStealthed, collision)) {
      this.startHunt();
    }

    if (this.eating && this.stepEating(dt)) {
      return null;
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
        nav && this.shouldPlanNavPath(hasLos);

      if (needPath) {
        this.planNavPath(nav, playerX, playerY);
      } else if (hasLos && this.navStuckTime < 0.12) {
        this.clearNavPath();
        this.navFailStreak = 0;
      }

      let targetX = playerX;
      let targetY = playerY;
      const waypoint = this.currentNavTarget();
      if (waypoint && this.shouldFollowNavWaypoint(hasLos)) {
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
        !seesPlayer &&
        this.navFailStreak >= 3 &&
        this.chaseNoProgressTime > 2.4 &&
        (!hasLos || this.navStuckTime > 1.5)
      ) {
        this.giveUpHunt();
      }
    } else if (!chasing) {
      this.clearNavPath();
      this.navFailStreak = 0;
      this.navStuckTime = 0;
      this.chaseNoProgressTime = 0;
      this.lastChaseDist = Infinity;

      const eatRadius = corpseEatRadiusPx(tileSize);
      let movingToCorpse = false;

      if (this.canSeekCorpse() && corpseIndex && canEatCorpse) {
        const visible = corpseIndex.findInVisionCone(
          this.x,
          this.y,
          this.facing,
          this.visionRadius,
          this.visionHalfAngle,
          collision ?? null,
        );
        if (visible && canEatCorpse(visible.id)) {
          this.setCorpseLure(visible.id, visible.x, visible.y);
        }
      }

      if (this.corpseLureId && canEatCorpse) {
        if (!canEatCorpse(this.corpseLureId)) {
          this.clearCorpseLure();
        } else {
          const tdx = this.corpseLureX - this.x;
          const tdy = this.corpseLureY - this.y;
          const tdist = Math.hypot(tdx, tdy) || 1;

          if (tdist <= eatRadius) {
            this.startEating(
              this.corpseLureId,
              this.corpseLureX,
              this.corpseLureY,
              corpseEatDurationSec(this.id, this.corpseLureId),
            );
            if (this.stepEating(dt)) {
              return null;
            }
          } else {
            movingToCorpse = true;
            const step = this.speed * 0.92 * dt;
            const hasLos =
              collision?.hasLineOfSight(
                this.x,
                this.y,
                this.corpseLureX,
                this.corpseLureY,
              ) ?? true;

            this.navReplanLeft -= dt;
            const needPath =
              nav && this.shouldPlanNavPath(hasLos);

            if (needPath) {
              this.planNavPath(nav, this.corpseLureX, this.corpseLureY);
            } else if (hasLos && this.navStuckTime < 0.12) {
              this.clearNavPath();
            }

            let targetX = this.corpseLureX;
            let targetY = this.corpseLureY;
            const waypoint = this.currentNavTarget();
            if (waypoint && this.shouldFollowNavWaypoint(hasLos)) {
              targetX = waypoint.x;
              targetY = waypoint.y;
            }

            const mdx = targetX - this.x;
            const mdy = targetY - this.y;
            const mdist = Math.hypot(mdx, mdy) || 1;
            if (mdist > 0.5) {
              wantX = (mdx / mdist) * step;
              wantY = (mdy / mdist) * step;
              moveFacing = Math.atan2(mdy, mdx);
            } else {
              moveFacing = Math.atan2(tdy, tdx);
            }
          }
        }
      }

      if (!movingToCorpse && !this.eating) {
        this.stepWander(dt);
        if (this.wanderPause <= 0) {
          const step = this.speed * dt;
          wantX = Math.cos(this.wanderAngle) * step;
          wantY = Math.sin(this.wanderAngle) * step;
          moveFacing = this.wanderAngle;
        }
      }
    } else if (chasing) {
      this.clearNavPath();
    }

    if (wantX !== 0 || wantY !== 0) {
      if (collision) {
        const moved = this.tryMoveWithSidestep(
          collision,
          wantX,
          wantY,
          worldW,
          worldH,
        );
        const blocked = moved.blocked;
        if (blocked) {
          if (chasing) {
            this.navStuckTime += dt;
            const los = collision.hasLineOfSight(
              this.x,
              this.y,
              playerX,
              playerY,
              playerRadius,
            );
            if (this.navStuckTime > 0.35) {
              this.navReplanLeft = 0;
            }
            if (los && this.navStuckTime > 0.5 && nav) {
              this.planNavPath(nav, playerX, playerY);
            }
            if (
              this.navStuckTime > 2.2 &&
              this.chaseNoProgressTime > 2.0 &&
              (!los || this.navStuckTime > 3.5)
            ) {
              this.giveUpHunt();
            }
          } else if (this.corpseLureId) {
            this.navReplanLeft = 0;
            this.navStuckTime += dt;
            this.handleWanderBlocked();
            moveFacing = this.wanderAngle;
          } else {
            this.handleWanderBlocked();
            moveFacing = this.wanderAngle;
          }
        } else {
          this.navStuckTime = Math.max(0, this.navStuckTime - dt * 0.5);
        }
        this._x = moved.x;
        this._y = moved.y;
      } else {
        this._x = Phaser.Math.Clamp(this.x + wantX, 0, worldW);
        this._y = Phaser.Math.Clamp(this.y + wantY, 0, worldH);
      }
      if (this.sprite) {
        this.sprite.x = this._x;
        this.sprite.y = this._y;
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
      return resolveZombieMeleeAttack(this.damageMin, this.damageMax);
    }
    return null;
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
    if (!this.hpBarFg) return;
    const ratio = this.hp / this.maxHp;
    const barW = this.elite ? 26 : 18;
    this.hpBarFg.width = barW * ratio;
  }

  destroy(): void {
    this.stopEating();
    this.releaseVisual();
    this.scene = null;
  }
}
