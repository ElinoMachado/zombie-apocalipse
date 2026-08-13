import Phaser from 'phaser';
import type { WorldCollision } from './WorldCollision';
import { PlayerProgression } from './progression/PlayerProgression';
import { talentEffectsFor } from './progression/talentEffects';
import { vitalityHpBonus } from './progression/attributes';
import type { EquipStatTotals } from './inventory/equipmentLoadout';
import type { SurvivalState } from './survival/SurvivalState';
import {
  backpedalSpeedFactor,
  CROUCH_SPEED_MULT,
  PLAYER_MAX_HP,
  PLAYER_MAX_STAMINA,
  PLAYER_WALK_SPEED,
  SPRINT_SPEED_MULT,
  STAMINA_CROUCH_DRAIN,
  STAMINA_REGEN,
  STAMINA_SPRINT_DRAIN,
} from './playerStats';

const EMPTY_EQUIP: EquipStatTotals = {
  armor: 0,
  noiseMod: 0,
  stealthMod: 0,
  capacityBonus: 0,
  slotBonus: 0,
  speedMod: 0,
  perceptionMod: 0,
  carryWeightMult: 1,
};

export {
  BACKPEDAL_SPEED_MULT,
  backpedalSpeedFactor,
  CROUCH_SPEED_MULT,
  isMovingBackwards,
  PLAYER_MAX_HP,
  PLAYER_MAX_STAMINA,
  PLAYER_WALK_SPEED,
  SPRINT_SPEED_MULT,
  STAMINA_CROUCH_DRAIN,
  STAMINA_REGEN,
  STAMINA_SPRINT_DRAIN,
  ZOMBIE_REF_CHASE_SPEED,
} from './playerStats';

/** Jogador — WASD, C stealth, Shift sprint, estamina, progressão. */
export class Player {
  readonly sprite: Phaser.GameObjects.Container;
  readonly progression = new PlayerProgression();
  private readonly body: Phaser.GameObjects.Arc;
  private readonly dir: Phaser.GameObjects.Triangle;

  /** Velocidade base em px/s (passo). */
  speed = PLAYER_WALK_SPEED;
  /** Raio de colisão. */
  radius = 6;
  maxHp = PLAYER_MAX_HP;
  hp = PLAYER_MAX_HP;
  /** Vida temporária (Persistente / Adrenalina, etc.). */
  tempHp = 0;
  maxStamina = PLAYER_MAX_STAMINA;
  stamina = PLAYER_MAX_STAMINA;
  alive = true;
  crouching = false;
  sprinting = false;

  /** Segundos restantes de queimadura (1 dmg/s). */
  private burnLeft = 0;
  private burnTick = 0;
  private survival: SurvivalState | null = null;
  private getEquipStats: () => EquipStatTotals = () => EMPTY_EQUIP;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.body = scene.add.circle(0, 0, 7, 0x58a6ff, 1);
    this.body.setStrokeStyle(2, 0x0d1117, 1);

    this.dir = scene.add.triangle(0, -10, 0, -5, -4, 2, 4, 2, 0xf0f6fc);

    this.sprite = scene.add.container(x, y, [this.body, this.dir]);
    this.sprite.setDepth(70);
    this.recalcFromTalents(false);
  }

  /** Recalcula stats derivados de talentos, equipamento e buffs. */
  recalcFromTalents(healOnIncrease = false): void {
    const fx = talentEffectsFor(this.progression);
    const vital = vitalityHpBonus(
      this.progression.attributes.vitality,
      this.progression.level,
    );
    const prevMax = this.maxHp;
    this.maxHp = PLAYER_MAX_HP + vital + fx.resilientBonusHp();
    if (healOnIncrease && this.maxHp > prevMax) {
      this.hp = this.maxHp;
    } else {
      this.hp = Math.min(this.hp, this.maxHp);
    }

    const eq = this.getEquipStats();
    const surv = this.survival;
    const speedMult =
      fx.moveSpeedMult() *
      (surv?.speedMultiplier() ?? 1) *
      (surv?.fatigueSpeedPenalty() ?? 1) *
      (1 + eq.speedMod);
    this.speed = PLAYER_WALK_SPEED * speedMult;

    const temp = fx.persistentTempHp();
    if (temp > 0) this.tempHp = Math.max(this.tempHp, temp);
  }

  setSurvival(state: SurvivalState | null): void {
    this.survival = state;
  }

  setEquipStatsProvider(fn: (() => EquipStatTotals) | null): void {
    this.getEquipStats = fn ?? (() => EMPTY_EQUIP);
    this.recalcFromTalents(false);
  }

  getEquipArmor(): number {
    return this.getEquipStats().armor;
  }

  /** Penalidade de combate por ferimentos / fadiga. */
  combatPenalty(): number {
    return this.survival?.combatPenalty() ?? 0;
  }

  heal(amount: number): number {
    if (!this.alive || amount <= 0) return 0;
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    return this.hp - before;
  }

  addStamina(amount: number): void {
    if (amount <= 0) return;
    this.stamina = Math.min(this.maxStamina, this.stamina + amount);
  }

  /** @deprecated use recalcFromTalents */
  recalcMaxHp(healOnIncrease = false): void {
    this.recalcFromTalents(healOnIncrease);
  }

  get x(): number {
    return this.sprite.x;
  }

  get y(): number {
    return this.sprite.y;
  }

  get isStealth(): boolean {
    return this.crouching && this.alive;
  }

  get staminaRatio(): number {
    return this.maxStamina > 0 ? this.stamina / this.maxStamina : 0;
  }

  setPosition(x: number, y: number): void {
    this.sprite.setPosition(x, y);
  }

  /** Roda o sprite para o ângulo de mira (mundo, radianos). */
  faceAim(aimAngle: number): void {
    this.sprite.setRotation(aimAngle + Math.PI / 2);
  }

  private applyStanceVisual(): void {
    if (!this.alive) return;
    if (this.crouching) {
      this.body.setScale(0.72);
      this.dir.setScale(0.72);
      this.body.setFillStyle(0x3d8bfd, 0.85);
      this.body.setStrokeStyle(2, 0x1f6feb, 1);
      this.sprite.setAlpha(0.88);
    } else if (this.sprinting) {
      this.body.setScale(1);
      this.dir.setScale(1);
      this.body.setFillStyle(0x79c0ff, 1);
      this.body.setStrokeStyle(2, 0x0d1117, 1);
      this.sprite.setAlpha(1);
    } else {
      this.body.setScale(1);
      this.dir.setScale(1);
      this.body.setFillStyle(this.burnLeft > 0 ? 0xff7043 : 0x58a6ff, 1);
      this.body.setStrokeStyle(2, 0x0d1117, 1);
      this.sprite.setAlpha(1);
    }
  }

  takeDamage(amount: number): number {
    if (!this.alive || amount <= 0) return 0;

    const armor = this.getEquipStats().armor;
    let remaining = Math.max(1, amount - armor);

    remaining = talentEffectsFor(this.progression).mitigateIncomingDamage(
      remaining,
    );

    if (this.tempHp > 0) {
      const absorbed = Math.min(this.tempHp, remaining);
      this.tempHp -= absorbed;
      remaining -= absorbed;
    }

    if (remaining <= 0) return amount;

    const applied = Math.min(this.hp, remaining);
    this.hp -= applied;

    if (this.hp <= 0 && this.survival?.preventLethal()) {
      this.hp = 1;
    }

    this.body.setFillStyle(0xff8a8a, 1);
    this.sprite.scene.time.delayedCall(80, () => {
      if (this.alive) this.applyStanceVisual();
    });
    if (this.hp <= 0) {
      this.alive = false;
      this.crouching = false;
      this.sprinting = false;
      this.sprite.setAlpha(0.45);
    }
    return applied;
  }

  /** Sangramento só por ataque crítico de zumbi (natural 20). */
  applyBleedingFromZombieCrit(): void {
    if (!this.alive || !this.survival) return;
    this.survival.bleeding = true;
  }

  /** Contacto com fogo: 1 de dano/s durante 3 s (renova). */
  ignite(durationSec = 3): void {
    if (!this.alive) return;
    this.burnLeft = Math.max(this.burnLeft, durationSec);
    if (!this.crouching) this.body.setFillStyle(0xff7043, 1);
  }

  get isBurning(): boolean {
    return this.burnLeft > 0;
  }

  /**
   * Avança DoT de queimadura.
   * @returns dano de fogo aplicado neste frame (para floaters).
   */
  updateBurn(deltaMs: number): number {
    if (!this.alive || this.burnLeft <= 0) return 0;
    const dt = deltaMs / 1000;
    this.burnLeft -= dt;
    this.burnTick += dt;
    let dealt = 0;
    while (this.burnTick >= 1) {
      this.burnTick -= 1;
      dealt += this.takeDamage(1);
    }
    if (this.burnLeft <= 0) {
      this.burnLeft = 0;
      this.burnTick = 0;
      if (this.alive) this.applyStanceVisual();
    }
    return dealt;
  }

  /**
   * Move + estamina (C stealth, Shift sprint).
   * Andar de costas suaviza a velocidade até {@link backpedalSpeedFactor}.
   * @returns distância percorrida neste frame (px).
   */
  update(
    deltaMs: number,
    keys: {
      W: Phaser.Input.Keyboard.Key;
      A: Phaser.Input.Keyboard.Key;
      S: Phaser.Input.Keyboard.Key;
      D: Phaser.Input.Keyboard.Key;
      C: Phaser.Input.Keyboard.Key;
      SHIFT: Phaser.Input.Keyboard.Key;
    },
    worldW: number,
    worldH: number,
    collision?: WorldCollision | null,
    aimAngle = 0,
    movementLocked = false,
  ): number {
    if (!this.alive) return 0;
    const dt = deltaMs / 1000;

    let dx = 0;
    let dy = 0;
    if (!movementLocked) {
      if (keys.A.isDown) dx -= 1;
      if (keys.D.isDown) dx += 1;
      if (keys.W.isDown) dy -= 1;
      if (keys.S.isDown) dy += 1;
    }
    const moving = dx !== 0 || dy !== 0;

    const wantCrouch = keys.C.isDown && this.stamina > 0.5;
    const wantSprint =
      !wantCrouch && keys.SHIFT.isDown && moving && this.stamina > 0.5;

    this.crouching = wantCrouch;
    this.sprinting = wantSprint;

    if (this.crouching) {
      this.stamina = Math.max(0, this.stamina - STAMINA_CROUCH_DRAIN * dt);
      if (this.stamina <= 0) this.crouching = false;
    } else if (this.sprinting) {
      this.stamina = Math.max(0, this.stamina - STAMINA_SPRINT_DRAIN * dt);
      if (this.stamina <= 0) this.sprinting = false;
    } else {
      this.stamina = Math.min(
        this.maxStamina,
        this.stamina + STAMINA_REGEN * dt,
      );
    }

    this.applyStanceVisual();

    if (!moving) return 0;

    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;

    let mult = 1;
    if (this.crouching) mult = CROUCH_SPEED_MULT;
    else if (this.sprinting) mult = SPRINT_SPEED_MULT;
    mult *= backpedalSpeedFactor(dx, dy, aimAngle);

    const step = this.speed * mult * dt;
    const wantX = dx * step;
    const wantY = dy * step;

    if (collision) {
      const result = collision.tryMove(
        this.sprite.x,
        this.sprite.y,
        wantX,
        wantY,
        this.radius,
        worldW,
        worldH,
      );
      if (result.moved > 0) {
        this.sprite.x = result.x;
        this.sprite.y = result.y;
      }
      return result.moved;
    }

    const nx = Phaser.Math.Clamp(this.sprite.x + wantX, 0, worldW);
    const ny = Phaser.Math.Clamp(this.sprite.y + wantY, 0, worldH);
    const moved = Math.hypot(nx - this.sprite.x, ny - this.sprite.y);
    this.sprite.x = nx;
    this.sprite.y = ny;
    return moved;
  }

  destroy(): void {
    this.sprite.destroy(true);
  }
}
