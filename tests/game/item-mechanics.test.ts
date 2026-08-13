import { describe, expect, it } from 'vitest';
import { applyConsumableEffects } from '../../src/game/inventory/consumableEffects';
import { EquipmentLoadout } from '../../src/game/inventory/equipmentLoadout';
import {
  syncInventoryCapacity,
  useConsumableAt,
} from '../../src/game/inventory/itemActions';
import { Inventory, MAX_CARRY_WEIGHT } from '../../src/game/inventory/inventory';
import { weaponDefFromItem } from '../../src/game/combat/itemWeapons';
import { SurvivalState } from '../../src/game/survival/SurvivalState';

describe('consumable mechanics', () => {
  it('bandage heals and stops bleeding', () => {
    const survival = new SurvivalState();
    survival.bleeding = true;
    let hp = 5;
    const target = {
      heal(n: number) {
        hp += n;
        return n;
      },
      maxHp: 16,
      hp,
      stamina: 50,
      maxStamina: 100,
      addStamina() {},
    };
    const result = applyConsumableEffects('bandage', survival, target);
    expect(result.ok).toBe(true);
    expect(survival.bleeding).toBe(false);
    expect(hp).toBe(13);
  });

  it('cloth stops bleeding without healing', () => {
    const survival = new SurvivalState();
    survival.bleeding = true;
    let hp = 10;
    const target = {
      heal() {
        return 0;
      },
      maxHp: 16,
      hp,
      stamina: 50,
      maxStamina: 100,
      addStamina() {},
    };
    const result = applyConsumableEffects('cloth', survival, target);
    expect(result.ok).toBe(true);
    expect(survival.bleeding).toBe(false);
    expect(hp).toBe(10);
  });

  it('uses consumable from inventory slot', () => {
    const inv = new Inventory();
    inv.tryAdd('bottled_water', 2);
    const survival = new SurvivalState();
    survival.hydration = 40;
    const target = {
      heal: () => 0,
      maxHp: 16,
      hp: 10,
      stamina: 50,
      maxStamina: 100,
      addStamina: () => {},
      recalcStats: () => {},
    };
    const result = useConsumableAt(inv, 0, survival, target);
    expect(result.ok).toBe(true);
    expect(survival.hydration).toBe(55);
    expect(inv.count('bottled_water')).toBe(1);
  });
});

describe('equipment loadout', () => {
  it('adds backpack capacity to inventory max weight', () => {
    const inv = new Inventory();
    const loadout = new EquipmentLoadout();
    expect(inv.maxWeight).toBe(MAX_CARRY_WEIGHT);
    loadout.equip('backpack', 'school_backpack');
    syncInventoryCapacity(inv, loadout);
    expect(inv.maxWeight).toBe(MAX_CARRY_WEIGHT + 8);
  });

  it('maps catalog weapon to combat stats', () => {
    const def = weaponDefFromItem('pistol_9mm');
    expect(def?.kind).toBe('ranged');
    expect(def?.damageMin).toBeGreaterThan(0);
    expect(def?.range).toBeGreaterThan(100);
  });
});
