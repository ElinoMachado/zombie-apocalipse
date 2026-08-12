import { rollDie } from '../combat/noiseAlert';
import { attributeModifier } from '../progression/attributes';
import type { LootTalentMods } from '../progression/talentEffects';
import { ITEMS, type ItemId, type ItemRarity } from '../inventory/inventory';
import { normalizeRarity } from '../inventory/itemTypes';

/** Dado de busca: baixo = comum, alto = raro. */
export const LOOT_DIE_SIDES = 20;

export interface LootRollResult {
  roll: number;
  naturalRoll: number;
  intellectMod: number;
  total: number;
  rarity: ItemRarity;
  itemId: ItemId;
  label: string;
}

const LOOT_RARITY_ORDER: ItemRarity[] = [
  'common',
  'uncommon',
  'rare',
  'super_rare',
  'ultra_rare',
  'top_secret',
];

/** Faixas de (d20 + mod intelecto) → raridade, de 10 em 10. */
export function rarityFromLootTotal(total: number): ItemRarity {
  if (total >= 51) return 'top_secret';
  if (total >= 41) return 'ultra_rare';
  if (total >= 31) return 'super_rare';
  if (total >= 21) return 'rare';
  if (total >= 11) return 'uncommon';
  return 'common';
}

/** @deprecated Use {@link rarityFromLootTotal}. */
export function rarityFromLootRoll(roll: number): ItemRarity {
  return rarityFromLootTotal(roll);
}

export function bumpRarityUp(rarity: ItemRarity): ItemRarity {
  const r = normalizeRarity(rarity);
  const idx = LOOT_RARITY_ORDER.indexOf(
    r as (typeof LOOT_RARITY_ORDER)[number],
  );
  if (idx < 0) return rarity;
  return LOOT_RARITY_ORDER[Math.min(idx + 1, LOOT_RARITY_ORDER.length - 1)]!;
}

export function bumpRarityDown(rarity: ItemRarity): ItemRarity {
  const r = normalizeRarity(rarity);
  const idx = LOOT_RARITY_ORDER.indexOf(
    r as (typeof LOOT_RARITY_ORDER)[number],
  );
  if (idx < 0) return 'common';
  return LOOT_RARITY_ORDER[Math.max(idx - 1, 0)]!;
}

/** Item representativo por faixa de raridade no loot procedural. */
const BY_RARITY: Partial<Record<ItemRarity, ItemId>> = {
  common: 'scrap',
  uncommon: 'cloth',
  rare: 'supplies',
  super_rare: 'rare_parts',
  legendary: 'rare_parts',
  ultra_rare: 'regenerative_serum',
  top_secret: 'experimental_nanomed',
};

export function itemForRarity(rarity: ItemRarity): ItemId {
  return BY_RARITY[rarity] ?? BY_RARITY.common ?? 'scrap';
}

/**
 * Rola loot com Intelecto: d20 + mod → raridade.
 * Natural 20 sobe 1 categoria. A cada 5 de mod → +1 item (raridades altas primeiro).
 */
export function rollLootWithIntellect(
  intellectScore: number,
  rng = Math.random,
  lootTalents?: LootTalentMods,
): LootRollResult[] {
  const mod =
    attributeModifier(intellectScore) + (lootTalents?.rollBonus ?? 0);
  const naturalRoll = rollDie(LOOT_DIE_SIDES, rng);
  const total = naturalRoll + mod;
  let rarity = rarityFromLootTotal(total);
  if (naturalRoll === LOOT_DIE_SIDES) rarity = bumpRarityUp(rarity);
  if (lootTalents?.crit19 && naturalRoll >= 19) rarity = bumpRarityUp(rarity);

  const bump = lootTalents?.rarityBump ?? 0;
  for (let i = 0; i < bump; i += 1) rarity = bumpRarityUp(rarity);

  const itemCount = 1 + Math.floor(mod / 5);
  const results: LootRollResult[] = [];

  for (let i = 0; i < itemCount; i += 1) {
    const tier = rarityStepsDown(rarity, i);
    const itemId = itemForRarity(tier);
    results.push({
      roll: naturalRoll,
      naturalRoll,
      intellectMod: mod,
      total,
      rarity: tier,
      itemId,
      label: ITEMS[itemId].label,
    });
  }

  return results;
}

function rarityStepsDown(base: ItemRarity, steps: number): ItemRarity {
  let r = base;
  for (let s = 0; s < steps; s += 1) r = bumpRarityDown(r);
  return r;
}

/** Compat: rolagem simples sem atributos (testes legados). */
export function rollLoot(
  rng = Math.random,
  luckBonus = 0,
): LootRollResult {
  const bonus = Math.round(Math.max(0, Math.min(1, luckBonus)) * 4);
  const naturalRoll = rollDie(LOOT_DIE_SIDES, rng);
  const total = Math.min(LOOT_DIE_SIDES + bonus, naturalRoll + bonus);
  const rarity = rarityFromLootTotal(total);
  const itemId = itemForRarity(rarity);
  return {
    roll: total,
    naturalRoll,
    intellectMod: 0,
    total,
    rarity,
    itemId,
    label: ITEMS[itemId].label,
  };
}

/** Densidade de pontos de busca no mapa (por célula amostrada). */
export function lootSiteDensityWeight(proximity: number): number {
  return 0.12 + proximity * proximity * 0.88;
}
