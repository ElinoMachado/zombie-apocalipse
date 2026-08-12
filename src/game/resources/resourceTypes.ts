/**
 * Compat + helpers de spawn de pontos de busca.
 * Itens concretos vêm da rolagem em {@link rollLoot}.
 */
export type { ItemId as ResourceId, ItemRarity as ResourceRarity } from '../inventory/inventory';
export { ITEMS as RESOURCES } from '../inventory/inventory';
export { lootSiteDensityWeight as resourceDensityWeight } from './lootTable';

/** @deprecated quantidade fixa — buscas agora dão 1 item via d20. */
export function resourceAmountForProximity(proximity: number): number {
  return Math.max(1, Math.round(1 + proximity * 5 + Math.random() * proximity * 3));
}

/** @deprecated preferir {@link rollLoot}. */
export function pickResourceId(
  proximity: number,
  rng = Math.random,
): 'scrap' | 'cloth' | 'supplies' | 'rare_parts' {
  const roll = rng();
  const legendary = 0.02 + proximity * 0.18;
  const rare = 0.06 + proximity * 0.28;
  const uncommon = 0.18 + proximity * 0.22;
  if (roll < legendary) return 'rare_parts';
  if (roll < legendary + rare) return 'supplies';
  if (roll < legendary + rare + uncommon) return 'cloth';
  return 'scrap';
}
