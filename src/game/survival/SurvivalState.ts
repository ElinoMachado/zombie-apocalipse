/** Estado corporal do jogador — fome, hidratação, ferimentos, buffs temporários. */

export type InfectionLevel = 'none' | 'mild' | 'advanced';

export interface SurvivalHealTarget {
  alive: boolean;
  hp: number;
  maxHp: number;
  heal(amount: number): number;
  takeDamage(amount: number): number;
  stamina: number;
  maxStamina: number;
}

export class SurvivalState {
  /** 0–100 (100 = saciado). */
  hunger = 100;
  /** 0–100 (100 = hidratado). */
  hydration = 100;
  bleeding = false;
  infection: InfectionLevel = 'none';
  /** 0–100 — penaliza estamina e velocidade. */
  fatigue = 0;
  /** Ferimentos leves / graves (consumíveis tratam). */
  minorWounds = false;
  majorWounds = false;

  /** Penalidade de combate por ferimento (analgésico suprime). */
  woundPenaltyUntil = 0;
  speedBuffMult = 1;
  speedBuffUntil = 0;
  adrenalineUntil = 0;
  antisepticUntil = 0;
  /** Cura gradual (soro regenerativo). */
  gradualHealLeft = 0;
  gradualHealPerSec = 0;
  /** Fadiga pós-estimulante. */
  stimCrashUntil = 0;

  private gameTimeMs = 0;
  private bleedTick = 0;

  get gameTime(): number {
    return this.gameTimeMs;
  }

  hasAdrenaline(): boolean {
    return this.gameTimeMs < this.adrenalineUntil;
  }

  hasWoundPenalty(): boolean {
    return this.gameTimeMs < this.woundPenaltyUntil;
  }

  speedMultiplier(): number {
    if (this.gameTimeMs >= this.speedBuffUntil) return 1;
    return this.speedBuffMult;
  }

  fatigueSpeedPenalty(): number {
    const f = this.fatigue / 100;
    if (this.gameTimeMs < this.stimCrashUntil) return 0.75 - f * 0.15;
    return 1 - f * 0.2;
  }

  /** Penalidade extra de acerto quando ferido (0–2). */
  combatPenalty(): number {
    if (!this.hasWoundPenalty() && !this.minorWounds && !this.majorWounds) {
      return 0;
    }
    let p = 0;
    if (this.hasWoundPenalty()) p += 1;
    if (this.minorWounds) p += 1;
    if (this.majorWounds) p += 2;
    return p;
  }

  /** Reduz dano recebido (armadura + resistências futuras). */
  armorDamageReduction(armor: number): number {
    return Math.max(0, armor);
  }

  update(deltaMs: number, target: SurvivalHealTarget): void {
    this.gameTimeMs += deltaMs;
    const dt = deltaMs / 1000;

    this.hunger = Math.max(0, this.hunger - 0.008 * dt);
    this.hydration = Math.max(0, this.hydration - 0.012 * dt);

    if (this.hunger < 25 || this.hydration < 20) {
      this.fatigue = Math.min(100, this.fatigue + 0.015 * dt);
    }

    if (this.bleeding && target.alive) {
      this.bleedTick += dt;
      while (this.bleedTick >= 2.5) {
        this.bleedTick -= 2.5;
        target.takeDamage(1);
        if (
          this.infection === 'none' &&
          this.gameTimeMs > this.antisepticUntil
        ) {
          this.infection = 'mild';
        }
      }
    }

    if (this.gradualHealLeft > 0 && target.alive) {
      this.gradualHealLeft -= dt;
      target.heal(this.gradualHealPerSec * dt);
    }

    if (this.gameTimeMs >= this.speedBuffUntil) {
      this.speedBuffMult = 1;
    }
  }

  /** Impede morte por 1 HP mínimo enquanto adrenalina activa. */
  preventLethal(): boolean {
    return this.hasAdrenaline();
  }

  reset(): void {
    this.hunger = 100;
    this.hydration = 100;
    this.bleeding = false;
    this.infection = 'none';
    this.fatigue = 0;
    this.minorWounds = false;
    this.majorWounds = false;
    this.woundPenaltyUntil = 0;
    this.speedBuffMult = 1;
    this.speedBuffUntil = 0;
    this.adrenalineUntil = 0;
    this.antisepticUntil = 0;
    this.gradualHealLeft = 0;
    this.gradualHealPerSec = 0;
    this.stimCrashUntil = 0;
    this.gameTimeMs = 0;
    this.bleedTick = 0;
  }
}
