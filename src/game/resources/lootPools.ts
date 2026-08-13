import { ITEM_CATALOG, type ItemId } from '../inventory/itemCatalog';
import {
  CORPSE_POI_TYPE_ID,
  ZOMBIE_CORPSE_POI_TYPE_ID,
} from '../../assets/pessoasMortas';
import {
  normalizeRarity,
  RARITY_ORDER,
  type ItemCategory,
  type ItemRarity,
} from '../inventory/itemTypes';

/** Categorias do catálogo que entram no loot de exploração. */
export const LOOT_CATEGORIES: readonly ItemCategory[] = [
  'consumable',
  'component',
  'utility',
  'melee_weapon',
  'firearm',
  'explosive',
  'armor',
  'backpack',
  'footwear',
  'accessory',
];

const LOOT_CATEGORY_SET = new Set<ItemCategory>(LOOT_CATEGORIES);

export type LootPoolByRarity = Record<
  (typeof RARITY_ORDER)[number],
  readonly ItemId[]
>;

/** Agrupa itens do catálogo (lista do utilizador) por raridade. */
export function buildLootPools(
  catalog: typeof ITEM_CATALOG = ITEM_CATALOG,
): LootPoolByRarity {
  const pools = Object.fromEntries(
    RARITY_ORDER.map((r) => [r, [] as ItemId[]]),
  ) as Record<(typeof RARITY_ORDER)[number], ItemId[]>;

  for (const id of Object.keys(catalog) as ItemId[]) {
    const def = catalog[id];
    if (!def || !LOOT_CATEGORY_SET.has(def.category)) continue;
    const rarity = normalizeRarity(def.rarity);
    pools[rarity].push(id);
  }

  for (const r of RARITY_ORDER) {
    pools[r].sort((a, b) => a.localeCompare(b));
  }

  return pools;
}

export const LOOT_POOLS: LootPoolByRarity = buildLootPools();

export const CORPSE_LOOT_SITE_TYPES = new Set<string>([
  CORPSE_POI_TYPE_ID,
  ZOMBIE_CORPSE_POI_TYPE_ID,
]);

/** Cadáveres humanos e de zumbi — pano é drop frequente. */
const CORPSE_CLOTH_CHANCE: Partial<Record<(typeof RARITY_ORDER)[number], number>> = {
  common: 0.6,
  uncommon: 0.35,
};

export function isCorpseLootSite(typeId: string): boolean {
  return CORPSE_LOOT_SITE_TYPES.has(typeId);
}

/** Sorteia item para o site; cadáveres favorecem pano (estanca sangramento). */
export function pickLootItemForSite(
  typeId: string,
  rarity: ItemRarity,
  rng = Math.random,
  pools: LootPoolByRarity = LOOT_POOLS,
): ItemId {
  const key = normalizeRarity(rarity) as (typeof RARITY_ORDER)[number];
  if (isCorpseLootSite(typeId)) {
    const clothChance = CORPSE_CLOTH_CHANCE[key];
    if (clothChance != null && rng() < clothChance) return 'cloth';
  }
  return pickLootItemForRarity(rarity, rng, pools);
}

/** Sorteia um item do catálogo para a raridade rolada. */
export function pickLootItemForRarity(
  rarity: ItemRarity,
  rng = Math.random,
  pools: LootPoolByRarity = LOOT_POOLS,
): ItemId {
  const key = normalizeRarity(rarity) as (typeof RARITY_ORDER)[number];
  const pool = pools[key];
  if (pool.length > 0) {
    return pool[Math.floor(rng() * pool.length)]!;
  }

  for (let i = RARITY_ORDER.indexOf(key); i >= 0; i -= 1) {
    const fallback = pools[RARITY_ORDER[i]!];
    if (fallback.length > 0) {
      return fallback[Math.floor(rng() * fallback.length)]!;
    }
  }

  return 'bottled_water';
}
