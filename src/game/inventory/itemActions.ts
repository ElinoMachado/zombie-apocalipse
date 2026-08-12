import type { CombatSystem } from '../combat/CombatSystem';
import { createWeaponFromItem } from '../combat/itemWeapons';
import type { SurvivalState } from '../survival/SurvivalState';
import {
  applyConsumableEffects,
  CONSUMABLE_EFFECTS,
} from './consumableEffects';
import {
  EquipmentLoadout,
  type EquipSlotId,
  type WeaponQuickSlotId,
} from './equipmentLoadout';
import { ITEMS, type Inventory, type ItemId } from './inventory';

export interface ItemActionTarget {
  heal(amount: number): number;
  maxHp: number;
  hp: number;
  stamina: number;
  maxStamina: number;
  addStamina(amount: number): void;
  recalcStats(): void;
}

export type ItemActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export function isConsumable(itemId: ItemId): boolean {
  return (
    ITEMS[itemId]?.category === 'consumable' && !!CONSUMABLE_EFFECTS[itemId]
  );
}

export function isWeaponItem(itemId: ItemId): boolean {
  const cat = ITEMS[itemId]?.category;
  return cat === 'firearm' || cat === 'melee_weapon';
}

export function isEquippable(itemId: ItemId): boolean {
  const def = ITEMS[itemId];
  if (!def) return false;
  return (
    def.category === 'firearm' ||
    def.category === 'melee_weapon' ||
    def.category === 'armor' ||
    def.category === 'backpack' ||
    def.category === 'footwear' ||
    def.category === 'accessory'
  );
}

export function useConsumableAt(
  inv: Inventory,
  slotIndex: number,
  survival: SurvivalState,
  target: ItemActionTarget,
): ItemActionResult {
  const slot = inv.slots[slotIndex];
  if (!slot) return { ok: false, message: 'Slot vazio.' };
  if (!isConsumable(slot.itemId)) {
    return { ok: false, message: 'Item não consumível.' };
  }

  const result = applyConsumableEffects(slot.itemId, survival, target);
  if (!result.ok) return result;

  if (!inv.removeAt(slotIndex, 1)) {
    return { ok: false, message: 'Falha ao consumir item.' };
  }
  return result;
}

export function equipFromInventoryAt(
  inv: Inventory,
  slotIndex: number,
  loadout: EquipmentLoadout,
  target: ItemActionTarget,
  combat: CombatSystem | null,
  preferredSlot?: EquipSlotId,
): ItemActionResult {
  const slot = inv.slots[slotIndex];
  if (!slot) return { ok: false, message: 'Slot vazio.' };

  const itemId = slot.itemId;
  const equipSlot = preferredSlot ?? loadout.slotForItem(itemId);
  if (!equipSlot) {
    return { ok: false, message: 'Item não equipável.' };
  }
  const prev = loadout.equip(equipSlot, itemId);
  if (prev === false) {
    return { ok: false, message: 'Slot incorrecto para este item.' };
  }

  if (!inv.removeAt(slotIndex, 1)) {
    if (prev) loadout.equip(equipSlot, prev);
    else loadout.unequip(equipSlot);
    return { ok: false, message: 'Falha ao remover do inventário.' };
  }

  if (prev && !inv.tryAdd(prev, 1).ok) {
    loadout.unequip(equipSlot);
    inv.tryAdd(itemId, 1);
    return { ok: false, message: 'Sem espaço para a peça anterior.' };
  }

  syncCombatWeapons(loadout, combat);
  target.recalcStats();
  return {
    ok: true,
    message: `${ITEMS[itemId]?.label ?? itemId} equipado.`,
  };
}

export function equipWeaponToQuickSlot(
  inv: Inventory,
  invIndex: number,
  loadout: EquipmentLoadout,
  quickSlot: WeaponQuickSlotId,
  target: ItemActionTarget,
  combat: CombatSystem | null,
): ItemActionResult {
  return equipFromInventoryAt(
    inv,
    invIndex,
    loadout,
    target,
    combat,
    quickSlot,
  );
}

export function unequipWeaponToInventory(
  loadout: EquipmentLoadout,
  quickSlot: WeaponQuickSlotId,
  inv: Inventory,
  target: ItemActionTarget,
  combat: CombatSystem | null,
  invIndex?: number,
): ItemActionResult {
  const itemId = loadout.get(quickSlot);
  if (!itemId) {
    return { ok: false, message: 'Slot de arma vazio.' };
  }

  if (invIndex != null) {
    if (inv.slots[invIndex]) {
      return { ok: false, message: 'Slot do inventário ocupado.' };
    }
    const def = ITEMS[itemId];
    if (inv.totalWeight + def.weight > inv.maxWeight) {
      return { ok: false, message: 'Peso excedido.' };
    }
    inv.slots[invIndex] = { itemId, qty: 1 };
  } else if (!inv.tryAdd(itemId, 1).ok) {
    return { ok: false, message: 'Inventário cheio.' };
  }

  loadout.unequip(quickSlot);
  syncCombatWeapons(loadout, combat);
  target.recalcStats();
  return {
    ok: true,
    message: `${ITEMS[itemId]?.label ?? itemId} guardado no inventário.`,
  };
}

export function unequipToInventory(
  loadout: EquipmentLoadout,
  equipSlot: EquipSlotId,
  inv: Inventory,
  target: ItemActionTarget,
  combat: CombatSystem | null,
): ItemActionResult {
  if (equipSlot === 'primary' || equipSlot === 'secondary') {
    return unequipWeaponToInventory(
      loadout,
      equipSlot,
      inv,
      target,
      combat,
    );
  }

  const prev = loadout.unequip(equipSlot);
  if (!prev) return { ok: false, message: 'Slot vazio.' };
  if (!inv.tryAdd(prev, 1).ok) {
    loadout.equip(equipSlot, prev);
    return { ok: false, message: 'Inventário cheio.' };
  }
  target.recalcStats();
  return { ok: true, message: `${ITEMS[prev]?.label ?? prev} desequipado.` };
}

export function syncCombatWeapons(
  loadout: EquipmentLoadout,
  combat: CombatSystem | null,
): void {
  if (!combat) return;

  const primaryId = loadout.equippedPrimary();
  const secondaryId = loadout.equippedSecondary();

  combat.setPrimaryEnabled(!!primaryId);
  combat.setSecondaryEnabled(!!secondaryId);

  if (primaryId) {
    const w = createWeaponFromItem(primaryId);
    if (w) combat.setPrimary(w);
  }
  if (secondaryId) {
    const w = createWeaponFromItem(secondaryId);
    if (w) combat.setSecondary(w);
  }
}

export function syncInventoryCapacity(
  inv: Inventory,
  loadout: EquipmentLoadout,
): void {
  inv.maxWeight =
    inv.baseMaxWeight + loadout.aggregateStats().capacityBonus;
}

export function useOrEquipAt(
  inv: Inventory,
  slotIndex: number,
  loadout: EquipmentLoadout,
  survival: SurvivalState,
  target: ItemActionTarget,
  combat: CombatSystem | null,
): ItemActionResult {
  const slot = inv.slots[slotIndex];
  if (!slot) return { ok: false, message: 'Slot vazio.' };
  if (isConsumable(slot.itemId)) {
    return useConsumableAt(inv, slotIndex, survival, target);
  }
  if (isEquippable(slot.itemId)) {
    return equipFromInventoryAt(inv, slotIndex, loadout, target, combat);
  }
  return { ok: false, message: 'Item não utilizável.' };
}

/** Botão direito no inventário: armas → slot rápido; resto usa/equipa. */
export function quickActionFromInventory(
  inv: Inventory,
  slotIndex: number,
  loadout: EquipmentLoadout,
  survival: SurvivalState,
  target: ItemActionTarget,
  combat: CombatSystem | null,
): ItemActionResult {
  const slot = inv.slots[slotIndex];
  if (!slot) return { ok: false, message: 'Slot vazio.' };
  if (isWeaponItem(slot.itemId)) {
    const qs = loadout.slotForItem(slot.itemId);
    if (qs === 'primary' || qs === 'secondary') {
      return equipFromInventoryAt(
        inv,
        slotIndex,
        loadout,
        target,
        combat,
        qs,
      );
    }
  }
  return useOrEquipAt(inv, slotIndex, loadout, survival, target, combat);
}
