/** Itens looteáveis + inventário com slots e peso. */

import { ITEM_CATALOG, type ItemId } from './itemCatalog';
import {
  CATEGORY_LABEL,
  normalizeRarity,
  RARITY_LABEL,
  rarityColor,
  type ItemCategory,
  type ItemRarity,
} from './itemTypes';

export type { ItemId, ItemRarity, ItemCategory };
export { RARITY_LABEL, CATEGORY_LABEL, rarityColor, normalizeRarity };

export interface ItemDef {
  id: ItemId;
  label: string;
  rarity: ItemRarity;
  category: ItemCategory;
  weight: number;
  color: number;
  maxStack: number;
  description: string;
  consumable?: (typeof ITEM_CATALOG)[ItemId]['consumable'];
  weapon?: (typeof ITEM_CATALOG)[ItemId]['weapon'];
  equip?: (typeof ITEM_CATALOG)[ItemId]['equip'];
}

function buildItemDef(id: ItemId): ItemDef {
  const src = ITEM_CATALOG[id];
  return {
    id,
    label: src.label,
    rarity: src.rarity,
    category: src.category,
    weight: src.weight,
    color: src.color ?? rarityColor(src.rarity),
    maxStack: src.maxStack,
    description: src.description,
    consumable: src.consumable,
    weapon: src.weapon,
    equip: src.equip,
  };
}

export const ITEMS: Record<ItemId, ItemDef> = Object.fromEntries(
  (Object.keys(ITEM_CATALOG) as ItemId[]).map((id) => [id, buildItemDef(id)]),
) as Record<ItemId, ItemDef>;

/** Texto completo para tooltip de inventário / loot. */
export function itemTooltipText(def: ItemDef, qty = 1): string {
  const lines = [
    RARITY_LABEL[normalizeRarity(def.rarity)],
    CATEGORY_LABEL[def.category],
    `peso ${def.weight}${qty > 1 ? ` (total ${def.weight * qty})` : ''}`,
  ];
  if (def.consumable) {
    lines.push(`Usos: ${def.consumable.uses} · ${def.consumable.effect}`);
  }
  if (def.weapon) {
    const w = def.weapon;
    lines.push(
      `Dano ${w.damageMin}–${w.damageMax} · CD ${w.cooldownSec}s · alcance ${w.range}`,
    );
    if (w.accuracy != null) {
      lines.push(`Precisão ${Math.round(w.accuracy * 100)}% · ruído ${w.noise}`);
    } else {
      lines.push(`Ruído ${w.noise} · ${w.weaponType}`);
    }
  }
  if (def.equip?.armor != null && def.equip.armor > 0) {
    lines.push(`Armadura +${def.equip.armor}`);
  }
  if (def.equip?.capacityBonus) {
    lines.push(`Capacidade +${def.equip.capacityBonus}`);
  }
  if (def.equip?.effect) lines.push(def.equip.effect);
  lines.push(def.description);
  return lines.join('\n');
}

/** Compat: aliases antigos. */
export type ResourceId = ItemId;
export type ResourceRarity = ItemRarity;
export const RESOURCES = ITEMS;

export const INVENTORY_SLOTS = 8;
export const MAX_CARRY_WEIGHT = 16;

export interface InventorySlot {
  itemId: ItemId;
  qty: number;
}

export type AddItemResult =
  | { ok: true; added: number }
  | { ok: false; reason: 'full' | 'overweight'; added: number };

export class Inventory {
  readonly slots: (InventorySlot | null)[];
  readonly baseMaxWeight: number;
  maxWeight: number;

  constructor(
    readonly slotCount = INVENTORY_SLOTS,
    baseMaxWeight = MAX_CARRY_WEIGHT,
  ) {
    this.baseMaxWeight = baseMaxWeight;
    this.maxWeight = baseMaxWeight;
    this.slots = Array.from({ length: slotCount }, () => null);
  }

  clear(): void {
    for (let i = 0; i < this.slots.length; i += 1) this.slots[i] = null;
  }

  get totalWeight(): number {
    let w = 0;
    for (const s of this.slots) {
      if (!s) continue;
      w += ITEMS[s.itemId].weight * s.qty;
    }
    return w;
  }

  count(itemId: ItemId): number {
    let n = 0;
    for (const s of this.slots) {
      if (s?.itemId === itemId) n += s.qty;
    }
    return n;
  }

  tryAdd(itemId: ItemId, qty = 1): AddItemResult {
    if (qty <= 0) return { ok: true, added: 0 };
    const def = ITEMS[itemId];
    if (!def) return { ok: false, reason: 'full', added: 0 };
    let remaining = qty;
    let added = 0;

    const canTake = (n: number): number => {
      const freeWeight = this.maxWeight - this.totalWeight;
      const byWeight = Math.floor(freeWeight / def.weight);
      return Math.max(0, Math.min(n, byWeight));
    };

    for (const s of this.slots) {
      if (!s || s.itemId !== itemId || remaining <= 0) continue;
      const room = def.maxStack - s.qty;
      if (room <= 0) continue;
      const take = Math.min(room, remaining, canTake(remaining));
      if (take <= 0) break;
      s.qty += take;
      remaining -= take;
      added += take;
    }

    while (remaining > 0) {
      const empty = this.slots.findIndex((s) => s == null);
      if (empty < 0) break;
      const take = Math.min(def.maxStack, remaining, canTake(remaining));
      if (take <= 0) break;
      this.slots[empty] = { itemId, qty: take };
      remaining -= take;
      added += take;
    }

    if (added === qty) return { ok: true, added };
    if (added === 0 && this.totalWeight + def.weight > this.maxWeight) {
      return { ok: false, reason: 'overweight', added: 0 };
    }
    if (this.totalWeight + def.weight > this.maxWeight) {
      return { ok: false, reason: 'overweight', added };
    }
    return { ok: false, reason: 'full', added };
  }

  /** Remove quantidade de um slot. Devolve false se impossível. */
  removeAt(index: number, qty = 1): boolean {
    const slot = this.slots[index];
    if (!slot || qty <= 0) return false;
    if (slot.qty < qty) return false;
    slot.qty -= qty;
    if (slot.qty <= 0) this.slots[index] = null;
    return true;
  }
}
