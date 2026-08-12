import { ITEMS, type ItemId } from './inventory';
import type { EquipItemStats } from './itemTypes';

export type EquipSlotId =
  | 'head'
  | 'chest'
  | 'arms'
  | 'legs'
  | 'feet'
  | 'primary'
  | 'secondary'
  | 'backpack'
  | 'accessory';

export type WeaponQuickSlotId = 'primary' | 'secondary';

const HEAD_ARMOR = new Set<ItemId>([
  'cap',
  'bike_helmet',
  'construction_helmet',
  'tactical_helmet',
  'advanced_military_helmet',
]);

const LEG_ARMOR = new Set<ItemId>(['partial_exoskeleton']);

export interface EquipStatTotals {
  armor: number;
  noiseMod: number;
  stealthMod: number;
  capacityBonus: number;
  slotBonus: number;
  speedMod: number;
  perceptionMod: number;
  carryWeightMult: number;
}

export class EquipmentLoadout {
  readonly slots: Partial<Record<EquipSlotId, ItemId>> = {};

  reset(): void {
    for (const k of Object.keys(this.slots) as EquipSlotId[]) {
      delete this.slots[k];
    }
  }

  /** Armas iniciais equipadas (não entram no inventário). */
  equipStarterWeapons(): void {
    this.equip('primary', 'pistol_9mm');
    this.equip('secondary', 'knife_melee');
  }

  get(slot: EquipSlotId): ItemId | null {
    return this.slots[slot] ?? null;
  }

  equippedPrimary(): ItemId | null {
    return this.get('primary');
  }

  equippedSecondary(): ItemId | null {
    return this.get('secondary');
  }

  slotForItem(itemId: ItemId): EquipSlotId | null {
    const def = ITEMS[itemId];
    if (!def) return null;
    switch (def.category) {
      case 'firearm':
        return 'primary';
      case 'melee_weapon':
        return 'secondary';
      case 'backpack':
        return 'backpack';
      case 'footwear':
        return 'feet';
      case 'accessory':
        return 'accessory';
      case 'armor':
        if (HEAD_ARMOR.has(itemId)) return 'head';
        if (LEG_ARMOR.has(itemId)) return 'legs';
        return 'chest';
      default:
        return null;
    }
  }

  canEquipInSlot(itemId: ItemId, slot: EquipSlotId): boolean {
    if (slot === 'primary') return ITEMS[itemId]?.category === 'firearm';
    if (slot === 'secondary') return ITEMS[itemId]?.category === 'melee_weapon';
    return this.slotForItem(itemId) === slot;
  }

  equip(slot: EquipSlotId, itemId: ItemId): ItemId | null | false {
    if (!this.canEquipInSlot(itemId, slot)) return false;
    const prev = this.slots[slot] ?? null;
    this.slots[slot] = itemId;
    return prev;
  }

  unequip(slot: EquipSlotId): ItemId | null {
    const prev = this.slots[slot] ?? null;
    delete this.slots[slot];
    return prev;
  }

  aggregateStats(): EquipStatTotals {
    const totals: EquipStatTotals = {
      armor: 0,
      noiseMod: 0,
      stealthMod: 0,
      capacityBonus: 0,
      slotBonus: 0,
      speedMod: 0,
      perceptionMod: 0,
      carryWeightMult: 1,
    };

    for (const itemId of Object.values(this.slots)) {
      if (!itemId) continue;
      const eq = ITEMS[itemId]?.equip;
      if (!eq) continue;
      this.addEquipStats(totals, eq);
    }

    if (totals.carryWeightMult === 1 && this.slots.backpack) {
      const id = this.slots.backpack;
      if (id === 'expedition_backpack') totals.carryWeightMult = 0.85;
      if (id === 'experimental_load_system') totals.carryWeightMult = 0.8;
    }

    return totals;
  }

  private addEquipStats(totals: EquipStatTotals, eq: EquipItemStats): void {
    totals.armor += eq.armor ?? 0;
    totals.noiseMod += eq.noiseMod ?? 0;
    totals.stealthMod += eq.stealthMod ?? 0;
    totals.capacityBonus += eq.capacityBonus ?? 0;
    totals.slotBonus += eq.slotBonus ?? 0;
    totals.speedMod += eq.speedMod ?? 0;
    totals.perceptionMod += eq.perceptionMod ?? 0;
  }

  labelForSlot(slot: EquipSlotId): string {
    const id = this.slots[slot];
    if (!id) return '—';
    return ITEMS[id]?.label ?? id;
  }
}
