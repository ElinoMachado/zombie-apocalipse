import { playerAC } from './attributes';
import type { PlayerProgression } from './PlayerProgression';

/** Valor numérico por nível de talento (índice 0 = nv1). */
function tier(values: readonly number[], level: number): number {
  if (level <= 0) return 0;
  return values[Math.min(level, values.length) - 1]!;
}

export interface LootTalentMods {
  rollBonus: number;
  rarityBump: number;
  /** Crítico de loot em 19–20 (Explorador). */
  crit19: boolean;
}

/** Bónus / regras activas derivadas dos talentos do jogador. */
export class TalentEffects {
  constructor(private readonly prog: PlayerProgression) {}

  private lv(id: string): number {
    return this.prog.getTalentLevel(id);
  }

  // — Visão —
  visionBonusTiles(): number {
    return tier([1, 2, 3, 5, 7, 12], this.lv('visao_aprimorada'));
  }

  // — Resistência / vida —
  resilientBonusHp(): number {
    return tier([4, 8, 12, 20, 40, 80], this.lv('resiliente'));
  }

  resistantBonusAc(): number {
    return tier([2, 3, 4, 5, 6, 10], this.lv('resistente'));
  }

  /** Média de d8 de vida temporária (Persistente). */
  persistentTempHp(): number {
    const d8 = tier([1, 2, 3, 4, 5, 6], this.lv('persistente'));
    if (d8 <= 0) return 0;
    return Math.round(d8 * 4.5);
  }

  playerAcBonus(): number {
    return this.resistantBonusAc();
  }

  playerAcTotal(reflexes: number, armorBonus = 0): number {
    return playerAC(reflexes) + this.playerAcBonus() + armorBonus;
  }

  /** Reduz dano recebido (CA de Resistente). */
  mitigateIncomingDamage(raw: number): number {
    const ac = this.resistantBonusAc();
    if (ac <= 0) return raw;
    return Math.max(1, raw - Math.floor(ac * 0.4));
  }

  // — Movimento —
  moveSpeedMult(): number {
    return 1 + tier([2, 4, 6, 8, 12, 20], this.lv('velocista')) * 0.02;
  }

  /** Bónus em testes de reflexo → pequena esquiva adicional. */
  reflexDodgeBonus(): number {
    return tier([2, 4, 6, 9, 12, 20], this.lv('rapido_flecha'));
  }

  // — Longo alcance —
  rangedHitBonus(): number {
    return (
      tier([2, 4, 6, 8, 12, 0], this.lv('olhos_de_aguia')) +
      tier([2, 4, 8, 12, 0, 0], this.lv('precisao_cirurgica'))
    );
  }

  rangedAutoHit(): boolean {
    return this.lv('olhos_de_aguia') >= 6;
  }

  rangedDamageBonus(): number {
    return tier([3, 6, 9, 12, 20, 70], this.lv('tiro_pesado'));
  }

  /** Inimigos extra atravessados pelo projétil (além do 1º). */
  projectilePierceExtra(): number {
    return tier([1, 2, 3, 4, 6, 10], this.lv('projeteis_penetrantes'));
  }

  stealthAttackAdvantage(): boolean {
    return this.lv('camuflagem_perfeita') >= 6;
  }

  // — Corpo a corpo —
  meleeHitBonus(): number {
    return tier([3, 6, 9, 12, 15, 30], this.lv('ataque_precisao'));
  }

  meleeDamageBonus(): number {
    let bonus = tier([3, 6, 9, 12, 50, 80], this.lv('golpe_pesado'));
    if (this.lv('forca_bruta') >= 6) {
      bonus += this.prog.getMod('strength');
    }
    return bonus;
  }

  /** Faca (cortante): dano extra por Corte limpo. */
  cuttingDamageBonus(): number {
    return Math.floor(tier([4, 6, 8, 10, 16, 18], this.lv('corte_limpo')) / 2);
  }

  meleeCooldownMult(): number {
    const lv = this.lv('ataque_extra_ranged');
    if (lv >= 6) return 0.6;
    if (lv >= 5) return 0.72;
    if (lv >= 4) return 0.85;
    return 1;
  }

  // — Exploração / loot —
  lootMods(): LootTalentMods {
    return {
      rollBonus: tier([1, 2, 3, 4, 5, 10], this.lv('explorador')),
      rarityBump: tier([1, 1, 2, 2, 2, 2], this.lv('explorador_nato')),
      crit19: this.lv('explorador') >= 1,
    };
  }

  maxLootSearchesPerSite(): number {
    return this.lv('mais_uma_vez') >= 6 ? 2 : 1;
  }

  // — Combate (rolagens) —
  rollAttack(
    attrMod: number,
    targetAc: number,
    opts: {
      autoHit?: boolean;
      advantage?: boolean;
      extraHit?: number;
    } = {},
    rng = Math.random,
  ): { hit: boolean; roll: number } {
    if (opts.autoHit) return { hit: true, roll: 20 };

    const rollOnce = () => 1 + Math.floor(rng() * 20);
    let roll = rollOnce();
    if (opts.advantage) roll = Math.max(roll, rollOnce());

    const total = roll + attrMod + (opts.extraHit ?? 0);
    return { hit: total >= targetAc, roll };
  }
}

export function talentEffectsFor(prog: PlayerProgression): TalentEffects {
  return new TalentEffects(prog);
}

const EMPTY_PROGRESSION = {
  getTalentLevel: () => 0,
  getMod: () => 0,
} as unknown as PlayerProgression;

/** Efeitos nulos quando não há progressão ligada. */
export const NO_TALENT_EFFECTS = new TalentEffects(EMPTY_PROGRESSION);
