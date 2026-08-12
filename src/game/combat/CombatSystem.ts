import Phaser from 'phaser';
import type { GameAudio } from '../../audio/GameAudio';
import {
  attributeModifier,
  ENEMY_BASE_AC,
  type AttributeScores,
} from '../progression/attributes';
import { NO_TALENT_EFFECTS, TalentEffects } from '../progression/talentEffects';
import type { WorldCollision } from '../WorldCollision';
import type { DamageNumbers } from './DamageNumbers';
import type { Enemy } from './Enemy';
import type { EnemyManager } from './EnemyManager';
import { rollNoiseAlert, type NoiseRollResult } from './noiseAlert';
import { isBackstabPosition } from './visionCone';
import { createWeaponFromId } from './itemWeapons';
import {
  BLOCK_DAMAGE_MULT,
  canStartReload,
  createReloadState,
  ENEMY_BLOCK_CHANCE,
  finishReload,
  rollWeaponDamage,
  type ReloadState,
  type WeaponInstance,
} from './weapons';

interface Bullet {
  gfx: Phaser.GameObjects.Arc;
  x: number;
  y: number;
  ox: number;
  oy: number;
  vx: number;
  vy: number;
  maxDist: number;
  damage: number;
  pierceLeft: number;
  hitIds: Set<string>;
  ignoreEnemyId: string | null;
}

interface SlashFx {
  gfx: Phaser.GameObjects.Graphics;
  life: number;
}

export type NoiseAlertHandler = (
  result: NoiseRollResult,
  playerX: number,
  playerY: number,
) => void;

export type EnemyKillHandler = (enemy: Enemy) => void;

/**
 * Combate: LMB pistola, RMB faca.
 * Acerto: 1d20 + mod (Força melee / Mira ranged) vs CA inimigo (10).
 * Fora de alcance: CA inimigo +50%. Força/Mira também somam ao dano.
 */
export class CombatSystem {
  primary: WeaponInstance;
  secondary: WeaponInstance;
  primaryEnabled = true;
  secondaryEnabled = true;
  readonly reload: ReloadState = createReloadState();
  /** Evita spam do click de pente vazio. */
  private dryFireCd = 0;

  private bullets: Bullet[] = [];
  private slashes: SlashFx[] = [];
  private readonly scene: Phaser.Scene;
  private enemies: EnemyManager;
  private collision: WorldCollision;
  private floaters: DamageNumbers;
  private audio: GameAudio | null;
  private onNoise: NoiseAlertHandler | null;
  private onKill: EnemyKillHandler | null = null;
  private getAttributes: (() => AttributeScores) | null = null;
  private getTalents: (() => TalentEffects) | null = null;
  private getStealth: (() => boolean) | null = null;
  private getAttackPenalty: (() => number) | null = null;

  constructor(
    scene: Phaser.Scene,
    enemies: EnemyManager,
    collision: WorldCollision,
    floaters: DamageNumbers,
    audio: GameAudio | null = null,
    onNoise: NoiseAlertHandler | null = null,
  ) {
    this.scene = scene;
    this.enemies = enemies;
    this.collision = collision;
    this.floaters = floaters;
    this.audio = audio;
    this.onNoise = onNoise;
    this.primary = createWeaponFromId('pistol_9mm');
    this.secondary = createWeaponFromId('knife_melee');
    scene.input.mouse?.disableContextMenu();
  }

  setPrimary(w: WeaponInstance): void {
    this.cancelReload();
    this.primary = w;
  }

  setSecondary(w: WeaponInstance): void {
    this.secondary = w;
  }

  setPrimaryEnabled(on: boolean): void {
    this.primaryEnabled = on;
    if (!on) this.cancelReload();
  }

  setSecondaryEnabled(on: boolean): void {
    this.secondaryEnabled = on;
  }

  setAttributeProvider(fn: (() => AttributeScores) | null): void {
    this.getAttributes = fn;
  }

  setTalentProvider(
    talents: (() => TalentEffects) | null,
    stealth: (() => boolean) | null = null,
  ): void {
    this.getTalents = talents;
    this.getStealth = stealth;
  }

  setKillHandler(fn: EnemyKillHandler | null): void {
    this.onKill = fn;
  }

  setAttackPenaltyProvider(fn: (() => number) | null): void {
    this.getAttackPenalty = fn;
  }

  private attackPenalty(): number {
    return this.getAttackPenalty?.() ?? 0;
  }

  private talents(): TalentEffects {
    return this.getTalents?.() ?? NO_TALENT_EFFECTS;
  }

  private attrs(): AttributeScores {
    return this.getAttributes?.() ?? {
      strength: 10,
      aim: 10,
      reflexes: 10,
      sanity: 10,
      intellect: 10,
      charisma: 10,
      vitality: 10,
      luck: 10,
      courage: 10,
    };
  }

  get isReloading(): boolean {
    return this.reload.active;
  }

  getWeapon(which: 'primary' | 'secondary'): WeaponInstance {
    return which === 'primary' ? this.primary : this.secondary;
  }

  update(
    deltaMs: number,
    playerX: number,
    playerY: number,
    aimAngle: number,
    pointer: Phaser.Input.Pointer,
    canAttack = true,
  ): void {
    const dt = deltaMs / 1000;
    this.primary.cooldownLeft = Math.max(0, this.primary.cooldownLeft - dt);
    this.secondary.cooldownLeft = Math.max(0, this.secondary.cooldownLeft - dt);
    this.stepReload(dt);
    if (this.dryFireCd > 0) this.dryFireCd -= dt;

    if (canAttack) {
      if (pointer.rightButtonDown()) {
        this.trySlashKnife(playerX, playerY, aimAngle);
      }
      if (pointer.leftButtonDown()) {
        this.tryFirePistol(playerX, playerY, aimAngle);
      }
    }

    this.stepBullets(dt);
    this.stepSlashFx(dt);
  }

  private stepReload(dt: number): void {
    if (!this.reload.active) return;
    this.reload.left -= dt;
    if (this.reload.left > 0) return;
    finishReload(this.primary);
    this.reload.active = false;
    this.reload.left = 0;
    this.reload.duration = 0;
  }

  private beginReload(): boolean {
    if (this.reload.active) return false;
    if (!canStartReload(this.primary)) return false;
    const duration = this.primary.def.reloadSec ?? 2;
    this.reload.active = true;
    this.reload.duration = duration;
    this.reload.left = duration;
    return true;
  }

  private cancelReload(): void {
    this.reload.active = false;
    this.reload.left = 0;
    this.reload.duration = 0;
  }

  private enemyAc(outOfRange: boolean): number {
    if (outOfRange) return Math.ceil(ENEMY_BASE_AC * 1.5);
    return ENEMY_BASE_AC;
  }

  private rollHit(
    mod: number,
    targetAc: number,
    opts: {
      autoHit?: boolean;
      advantage?: boolean;
      extraHit?: number;
    } = {},
    rng = Math.random,
  ): { hit: boolean; roll: number } {
    return this.talents().rollAttack(mod, targetAc, opts, rng);
  }

  private applyDamageBonus(base: number, mod: number): number {
    return Math.max(1, base + mod);
  }

  private dealHit(
    e: Enemy,
    rawDamage: number,
    kind: 'normal' | 'crit' = 'normal',
  ): void {
    const blocked = Math.random() < ENEMY_BLOCK_CHANCE;
    const damage = blocked
      ? Math.max(1, Math.floor(rawDamage * BLOCK_DAMAGE_MULT))
      : rawDamage;
    const killed = e.takeDamage(damage);
    if (blocked) this.floaters.showBlocked(e.x, e.y, damage);
    else if (kind === 'crit') this.floaters.showCritical(e.x, e.y, damage);
    else this.floaters.showOutgoing(e.x, e.y, damage);
    if (killed) this.onKill?.(e);
  }

  private findAimedEnemy(
    px: number,
    py: number,
    aimAngle: number,
    maxAlong: number,
  ): Enemy | null {
    const cos = Math.cos(aimAngle);
    const sin = Math.sin(aimAngle);
    let best: Enemy | null = null;
    let bestAlong = Infinity;

    for (const e of this.enemies.all) {
      if (!e.alive) continue;
      const dx = e.x - px;
      const dy = e.y - py;
      const along = dx * cos + dy * sin;
      if (along < 0 || along > maxAlong + e.radius) continue;
      const perp = Math.abs(dx * sin - dy * cos);
      if (perp > e.radius + 6) continue;
      if (along < bestAlong) {
        bestAlong = along;
        best = e;
      }
    }
    return best;
  }

  private tryFirePistol(px: number, py: number, aimAngle: number): void {
    if (!this.primaryEnabled) return;
    const w = this.primary;
    if (this.reload.active) return;
    if (w.cooldownLeft > 0) return;

    if (w.ammoInMag <= 0) {
      if (this.dryFireCd > 0) return;
      if (this.beginReload()) {
        this.audio?.playReload(w.def.id);
      } else {
        this.dryFireCd = 0.35;
        this.audio?.playDryFire();
      }
      return;
    }

    w.ammoInMag -= 1;
    w.cooldownLeft = w.def.cooldownSec;
    this.audio?.playWeaponFire(w.def.id);

    if (w.def.noisy) {
      const noise = rollNoiseAlert();
      this.onNoise?.(noise, px, py);
    }

    const range = w.def.range;
    const speed = w.def.projectileSpeed ?? 500;
    const aimReach = range * 2.5;
    const target = this.findAimedEnemy(px, py, aimAngle, aimReach);

    let fireAngle = aimAngle;
    let ignoreEnemyId: string | null = null;
    let maxDist = range;
    const aimMod = attributeModifier(this.attrs().aim);
    const fx = this.talents();
    const stealth = this.getStealth?.() ?? false;
    const advantage = stealth && fx.stealthAttackAdvantage();

    if (target) {
      const dist = Math.hypot(target.x - px, target.y - py);
      const outOfRange = dist > range;
      const ac = this.enemyAc(outOfRange) + this.attackPenalty();
      const { hit } = this.rollHit(aimMod, ac, {
        autoHit: fx.rangedAutoHit(),
        advantage,
        extraHit: fx.rangedHitBonus(),
      });

      if (hit) {
        fireAngle = Math.atan2(target.y - py, target.x - px);
        maxDist = Math.max(range, dist + target.radius);
      } else {
        this.floaters.showMiss(target.x, target.y);
        ignoreEnemyId = target.id;
        const toT = Math.atan2(target.y - py, target.x - px);
        const side = Math.random() < 0.5 ? 1 : -1;
        fireAngle = toT + side * (0.22 + Math.random() * 0.16);
        maxDist = Math.max(range, dist + target.radius);
      }
    }

    const muzzle = 10;
    const bx = px + Math.cos(fireAngle) * muzzle;
    const by = py + Math.sin(fireAngle) * muzzle;
    const baseDmg = rollWeaponDamage(w.def);
    const damage = this.applyDamageBonus(
      baseDmg,
      aimMod + fx.rangedDamageBonus(),
    );

    const gfx = this.scene.add.circle(bx, by, 2.2, 0xffe082, 1);
    gfx.setDepth(58);
    this.bullets.push({
      gfx,
      x: bx,
      y: by,
      ox: px,
      oy: py,
      vx: Math.cos(fireAngle) * speed,
      vy: Math.sin(fireAngle) * speed,
      maxDist,
      damage,
      pierceLeft: fx.projectilePierceExtra(),
      hitIds: new Set<string>(),
      ignoreEnemyId,
    });

    if (w.ammoInMag <= 0 && this.beginReload()) {
      this.audio?.playReload(w.def.id);
    }
  }

  private trySlashKnife(px: number, py: number, aimAngle: number): void {
    if (!this.secondaryEnabled) return;
    const w = this.secondary;
    if (w.cooldownLeft > 0) return;
    if (w.durability <= 0) return;

    if (this.reload.active) this.cancelReload();

    w.cooldownLeft = w.def.cooldownSec * this.talents().meleeCooldownMult();

    const range = w.def.range;
    const half = w.def.slashHalfAngle ?? Math.PI / 3;
    const victims = this.enemies.hitTestSlash(px, py, aimAngle, range, half);
    const hitSolid = this.slashHitsSolid(px, py, aimAngle, range, half);

    const strMod = attributeModifier(this.attrs().strength);
    const fx = this.talents();
    const stealth = this.getStealth?.() ?? false;
    const advantage = stealth && fx.stealthAttackAdvantage();

    if (victims.length > 0) {
      w.durability = Math.max(0, w.durability - (w.def.durabilityCost ?? 1));
    }

    let dealtDamage = false;
    for (const e of victims) {
      const backstab = isBackstabPosition(e.x, e.y, e.facing, px, py);
      if (!backstab) {
        const ac = this.enemyAc(false) + this.attackPenalty();
        const { hit } = this.rollHit(strMod, ac, {
          advantage,
          extraHit: fx.meleeHitBonus(),
        });
        if (!hit) {
          this.floaters.showMiss(e.x, e.y);
          continue;
        }
      }
      dealtDamage = true;
      const base = backstab
        ? w.def.damageMax * 2
        : rollWeaponDamage(w.def);
      let damage = backstab
        ? base
        : this.applyDamageBonus(
            base,
            strMod + fx.meleeDamageBonus() + fx.cuttingDamageBonus(),
          );
      if (backstab) {
        damage += fx.cuttingDamageBonus();
      }
      this.dealHit(e, damage, backstab ? 'crit' : 'normal');
    }

    if (dealtDamage || hitSolid) {
      this.audio?.playKnifeHit();
    } else if (victims.length > 0) {
      this.audio?.playKnifeMiss();
    } else {
      this.audio?.playKnifeNoHit();
    }

    this.spawnSlashFx(px, py, aimAngle, range, half);
  }

  /** Golpe intersecta parede, carro ou outro sólido. */
  private slashHitsSolid(
    px: number,
    py: number,
    aimAngle: number,
    range: number,
    half: number,
  ): boolean {
    const angleSamples = 3;
    const distSamples = 4;
    for (let a = 0; a < angleSamples; a += 1) {
      const t = angleSamples === 1 ? 0.5 : a / (angleSamples - 1);
      const ang = aimAngle - half + t * (2 * half);
      for (let s = 1; s <= distSamples; s += 1) {
        const dist = (s / distSamples) * range;
        const x = px + Math.cos(ang) * dist;
        const y = py + Math.sin(ang) * dist;
        if (this.collision.hits({ x, y, radius: 4 })) return true;
      }
    }
    return false;
  }

  private spawnSlashFx(
    px: number,
    py: number,
    aimAngle: number,
    range: number,
    half: number,
  ): void {
    const g = this.scene.add.graphics();
    g.setDepth(57);
    g.fillStyle(0xffffff, 0.35);
    g.beginPath();
    g.moveTo(px, py);
    g.arc(px, py, range, aimAngle - half, aimAngle + half, false);
    g.closePath();
    g.fillPath();
    g.lineStyle(2, 0xf0f6fc, 0.85);
    g.beginPath();
    g.arc(px, py, range, aimAngle - half, aimAngle + half, false);
    g.strokePath();
    this.slashes.push({ gfx: g, life: 0.12 });
  }

  private stepBullets(dt: number): void {
    const step = 4;
    for (let i = this.bullets.length - 1; i >= 0; i -= 1) {
      const b = this.bullets[i]!;
      const traveled = Math.hypot(b.x - b.ox, b.y - b.oy);
      if (traveled >= b.maxDist) {
        b.gfx.destroy();
        this.bullets.splice(i, 1);
        continue;
      }

      const dist = Math.hypot(b.vx, b.vy) * dt;
      const parts = Math.max(1, Math.ceil(dist / step));
      const sx = (b.vx * dt) / parts;
      const sy = (b.vy * dt) / parts;
      let dead = false;

      for (let s = 0; s < parts; s += 1) {
        b.x += sx;
        b.y += sy;
        if (Math.hypot(b.x - b.ox, b.y - b.oy) >= b.maxDist) {
          dead = true;
          break;
        }
        if (this.collision.hits({ x: b.x, y: b.y, radius: 2 })) {
          dead = true;
          break;
        }
        const hit = this.enemies.hitTestPoint(b.x, b.y, 2);
        if (hit && hit.id !== b.ignoreEnemyId && !b.hitIds.has(hit.id)) {
          this.dealHit(hit, b.damage);
          b.hitIds.add(hit.id);
          if (b.pierceLeft <= 0) {
            dead = true;
            break;
          }
          b.pierceLeft -= 1;
          continue;
        }
      }

      if (dead) {
        b.gfx.destroy();
        this.bullets.splice(i, 1);
      } else {
        b.gfx.setPosition(b.x, b.y);
      }
    }
  }

  private stepSlashFx(dt: number): void {
    for (let i = this.slashes.length - 1; i >= 0; i -= 1) {
      const fx = this.slashes[i]!;
      fx.life -= dt;
      if (fx.life <= 0) {
        fx.gfx.destroy();
        this.slashes.splice(i, 1);
      } else {
        fx.gfx.setAlpha(Math.max(0, fx.life / 0.12));
      }
    }
  }

  destroy(): void {
    this.cancelReload();
    for (const b of this.bullets) b.gfx.destroy();
    for (const s of this.slashes) s.gfx.destroy();
    this.bullets = [];
    this.slashes = [];
  }
}
