import { rollDie } from '../combat/noiseAlert';
import { attributeModifier } from '../progression/attributes';
import type { LootTalentMods } from '../progression/talentEffects';
import { ITEMS, type ItemId, type ItemRarity } from '../inventory/inventory';
import { normalizeRarity } from '../inventory/itemTypes';
import { pickLootItemForRarity, pickLootItemForSite } from './lootPools';

export {
  LOOT_POOLS,
  buildLootPools,
  pickLootItemForRarity,
  pickLootItemForSite,
  isCorpseLootSite,
} from './lootPools';

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

/** Quantidade de itens: total arredondado para cima em degraus de 10. */
export function lootItemCountFromTotal(total: number): number {
  return Math.max(1, Math.ceil(total / 10));
}

/**
 * Total usado na faixa do i-ésimo item (1-based).
 * Degraus 10, 20, …; no último slot usa o total (ou total+10 se só 2 itens abaixo de 20).
 */
export function lootTierTotalForItem(
  total: number,
  itemIndex1Based: number,
  itemCount: number,
): number {
  if (itemIndex1Based >= itemCount) {
    if (itemCount === 2 && total < 20) return total + 10;
    return total;
  }
  return itemIndex1Based * 10;
}

/** Raridades por degrau de 10; natural 20 / talentos sobem cada item, não a quantidade. */
export function lootRarityTiersFromTotal(
  total: number,
  naturalRoll: number,
  lootTalents?: LootTalentMods,
): ItemRarity[] {
  const count = lootItemCountFromTotal(total);
  const rarities: ItemRarity[] = [];
  for (let i = 1; i <= count; i += 1) {
    const tierTotal = lootTierTotalForItem(total, i, count);
    let rarity = rarityFromLootTotal(tierTotal);
    if (naturalRoll === LOOT_DIE_SIDES) rarity = bumpRarityUp(rarity);
    if (lootTalents?.crit19 && naturalRoll >= 19) rarity = bumpRarityUp(rarity);
    const bump = lootTalents?.rarityBump ?? 0;
    for (let b = 0; b < bump; b += 1) rarity = bumpRarityUp(rarity);
    rarities.push(rarity);
  }
  return rarities;
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

/** Sorteia item do catálogo para a raridade (pool por faixa). */
export function itemForRarity(
  rarity: ItemRarity,
  rng = Math.random,
  lootSiteTypeId?: string,
): ItemId {
  if (lootSiteTypeId) {
    return pickLootItemForSite(lootSiteTypeId, rarity, rng);
  }
  return pickLootItemForRarity(rarity, rng);
}

/**
 * Rola loot com Intelecto: d20 + mod → faixas de 10.
 * Quantidade = ceil(total / 10). Cada item num degrau (10, 20, …, total).
 * Natural 20 sobe a raridade de cada item, sem acrescentar quantidade extra.
 */
export function rollLootWithIntellect(
  intellectScore: number,
  rng = Math.random,
  lootTalents?: LootTalentMods,
  proximityLootBonus = 0,
  lootSiteTypeId?: string,
): LootRollResult[] {
  const mod =
    attributeModifier(intellectScore) +
    (lootTalents?.rollBonus ?? 0) +
    Math.max(0, proximityLootBonus);
  const naturalRoll = rollDie(LOOT_DIE_SIDES, rng);
  const total = naturalRoll + mod;
  const rarityTiers = lootRarityTiersFromTotal(total, naturalRoll, lootTalents);
  const results: LootRollResult[] = [];

  for (let i = 0; i < rarityTiers.length; i += 1) {
    const tier = rarityTiers[i]!;
    const itemId = itemForRarity(tier, rng, lootSiteTypeId);
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

/** Compat: rolagem simples sem atributos (testes legados). */
export function rollLoot(
  rng = Math.random,
  luckBonus = 0,
): LootRollResult {
  const bonus = Math.round(Math.max(0, Math.min(1, luckBonus)) * 4);
  const naturalRoll = rollDie(LOOT_DIE_SIDES, rng);
  const total = Math.min(LOOT_DIE_SIDES + bonus, naturalRoll + bonus);
  const rarity = rarityFromLootTotal(total);
  const itemId = itemForRarity(rarity, rng);
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
  return 0.015 + proximity * 0.985;
}
