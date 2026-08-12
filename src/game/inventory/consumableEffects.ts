import type { ItemId } from './itemCatalog';
import type { SurvivalState } from '../survival/SurvivalState';

export type ConsumableEffect =
  | { kind: 'heal'; amount: number }
  | { kind: 'healPercent'; ratio: number }
  | { kind: 'hunger'; amount: number }
  | { kind: 'hydration'; amount: number }
  | { kind: 'stamina'; amount: number }
  | { kind: 'clearBleeding' }
  | { kind: 'clearInfection'; level?: 'mild' | 'advanced' | 'any' }
  | { kind: 'antiseptic'; durationSec: number }
  | { kind: 'woundPenalty'; durationSec: number }
  | { kind: 'treatMinorWounds' }
  | { kind: 'treatMajorWounds' }
  | { kind: 'clearAllWounds' }
  | { kind: 'speedBuff'; mult: number; durationSec: number; reduceFatigue?: number }
  | { kind: 'adrenaline'; durationSec: number }
  | { kind: 'gradualHeal'; total: number; durationSec: number }
  | { kind: 'stimulant'; durationSec: number; crashSec: number }
  | { kind: 'fatigue'; amount: number };

/** Efeitos por item consumível. */
export const CONSUMABLE_EFFECTS: Partial<Record<ItemId, ConsumableEffect[]>> = {
  bottled_water: [{ kind: 'hydration', amount: 15 }],
  canned_food: [{ kind: 'hunger', amount: 20 }],
  bandage: [{ kind: 'clearBleeding' }, { kind: 'heal', amount: 8 }],
  painkiller: [{ kind: 'woundPenalty', durationSec: 60 }],
  antiseptic: [{ kind: 'antiseptic', durationSec: 300 }],
  premium_canned_meat: [{ kind: 'hunger', amount: 35 }],
  basic_medkit: [
    { kind: 'heal', amount: 30 },
    { kind: 'treatMinorWounds' },
    { kind: 'clearBleeding' },
  ],
  antibiotic: [{ kind: 'clearInfection', level: 'mild' }],
  energy_drink: [
    { kind: 'speedBuff', mult: 1.15, durationSec: 90, reduceFatigue: 15 },
  ],
  military_mre: [{ kind: 'hunger', amount: 55 }, { kind: 'stamina', amount: 10 }],
  surgical_kit: [{ kind: 'treatMajorWounds' }, { kind: 'clearBleeding' }],
  stimulant: [{ kind: 'stimulant', durationSec: 120, crashSec: 90 }],
  adrenaline_syringe: [{ kind: 'adrenaline', durationSec: 20 }],
  experimental_antiviral: [{ kind: 'clearInfection', level: 'advanced' }],
  regenerative_serum: [{ kind: 'gradualHeal', total: 60, durationSec: 30 }],
  experimental_nanomed: [
    { kind: 'healPercent', ratio: 0.95 },
    { kind: 'clearAllWounds' },
    { kind: 'clearBleeding' },
    { kind: 'clearInfection', level: 'any' },
  ],
};

export interface ApplyConsumableTarget {
  heal(amount: number): number;
  maxHp: number;
  hp: number;
  stamina: number;
  maxStamina: number;
  addStamina(amount: number): void;
}

export interface ApplyConsumableResult {
  ok: boolean;
  message: string;
}

export function applyConsumableEffects(
  itemId: ItemId,
  survival: SurvivalState,
  target: ApplyConsumableTarget,
): ApplyConsumableResult {
  const effects = CONSUMABLE_EFFECTS[itemId];
  if (!effects?.length) {
    return { ok: false, message: 'Item não consumível.' };
  }

  const parts: string[] = [];
  const now = survival.gameTime;

  for (const fx of effects) {
    switch (fx.kind) {
      case 'heal': {
        const gained = target.heal(fx.amount);
        if (gained > 0) parts.push(`+${Math.ceil(gained)} HP`);
        break;
      }
      case 'healPercent': {
        const amount = Math.ceil(target.maxHp * fx.ratio);
        const gained = target.heal(amount);
        if (gained > 0) parts.push(`+${Math.ceil(gained)} HP`);
        break;
      }
      case 'hunger':
        survival.hunger = Math.min(100, survival.hunger + fx.amount);
        parts.push(`+${fx.amount} fome`);
        break;
      case 'hydration':
        survival.hydration = Math.min(100, survival.hydration + fx.amount);
        parts.push(`+${fx.amount} hidratação`);
        break;
      case 'stamina':
        target.addStamina(fx.amount);
        parts.push(`+${fx.amount} estamina`);
        break;
      case 'clearBleeding':
        if (survival.bleeding) {
          survival.bleeding = false;
          parts.push('Sangramento parado');
        }
        break;
      case 'clearInfection': {
        const ok =
          fx.level === 'any'
            ? survival.infection !== 'none'
            : fx.level === 'advanced'
              ? survival.infection === 'advanced'
              : survival.infection === 'mild';
        if (ok) {
          survival.infection = 'none';
          parts.push('Infecção tratada');
        }
        break;
      }
      case 'antiseptic':
        survival.antisepticUntil = now + fx.durationSec * 1000;
        parts.push('Risco de infecção reduzido');
        break;
      case 'woundPenalty':
        survival.woundPenaltyUntil = now + fx.durationSec * 1000;
        parts.push('Dor aliviada');
        break;
      case 'treatMinorWounds':
        if (survival.minorWounds) {
          survival.minorWounds = false;
          parts.push('Ferimentos leves tratados');
        }
        break;
      case 'treatMajorWounds':
        if (survival.majorWounds) {
          survival.majorWounds = false;
          survival.minorWounds = false;
          parts.push('Ferimentos graves tratados');
        }
        break;
      case 'clearAllWounds':
        survival.minorWounds = false;
        survival.majorWounds = false;
        parts.push('Ferimentos removidos');
        break;
      case 'speedBuff':
        survival.speedBuffMult = fx.mult;
        survival.speedBuffUntil = now + fx.durationSec * 1000;
        if (fx.reduceFatigue) {
          survival.fatigue = Math.max(0, survival.fatigue - fx.reduceFatigue);
        }
        parts.push(`Velocidade +${Math.round((fx.mult - 1) * 100)}%`);
        break;
      case 'adrenaline':
        survival.adrenalineUntil = now + fx.durationSec * 1000;
        parts.push('Adrenalina activa');
        break;
      case 'gradualHeal':
        survival.gradualHealLeft = fx.durationSec;
        survival.gradualHealPerSec = fx.total / fx.durationSec;
        parts.push(`Regeneração +${fx.total} HP`);
        break;
      case 'stimulant':
        survival.speedBuffMult = 1.1;
        survival.speedBuffUntil = now + fx.durationSec * 1000;
        survival.fatigue = Math.max(0, survival.fatigue - 20);
        survival.stimCrashUntil = now + fx.durationSec * 1000 + fx.crashSec * 1000;
        parts.push('Estimulante activo');
        break;
      case 'fatigue':
        survival.fatigue = Math.min(100, survival.fatigue + fx.amount);
        break;
      default:
        break;
    }
  }

  if (parts.length === 0) {
    return { ok: true, message: 'Usado (sem efeito adicional).' };
  }
  return { ok: true, message: parts.join(' · ') };
}
