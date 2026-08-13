import { describe, expect, it } from 'vitest';
import {
  enemyDamageRange,
  enemyHpForProximity,
  isWithinRadiusPx,
  playerSpawnClearancePx,
  proximityFromCenter,
  spawnDensityWeight,
} from '../../src/game/combat/cityThreat';
import { Inventory, ITEMS, MAX_CARRY_WEIGHT } from '../../src/game/inventory/inventory';
import {
  CAR_LOOT_PRESENCE_CHANCE,
  CAR_LOOT_PRESENCE_CHANCE_CENTER,
  LOOT_PRESENCE_CHANCE,
  LOOT_PRESENCE_CHANCE_CENTER,
  LOOT_SEARCH_MS,
  SURVIVAL_SENSE_COOLDOWN_MS,
  SURVIVAL_SENSE_RADIUS_MULT,
  lootPresenceChance,
} from '../../src/game/resources/ResourceManager';
import {
  rarityFromLootRoll,
  rollLoot,
} from '../../src/game/resources/lootTable';
import { LOOT_POOLS } from '../../src/game/resources/lootPools';
import {
  pickResourceId,
  resourceAmountForProximity,
  resourceDensityWeight,
} from '../../src/game/resources/resourceTypes';

describe('cityThreat', () => {
  it('scales enemy hp from 6 (edge) to 20 (center)', () => {
    expect(enemyHpForProximity(0)).toBe(6);
    expect(enemyHpForProximity(1)).toBe(20);
  });

  it('scales damage 1-2 far and 4-12 near center', () => {
    expect(enemyDamageRange(0)).toEqual({ min: 1, max: 2 });
    expect(enemyDamageRange(1)).toEqual({ min: 4, max: 12 });
  });

  it('has denser spawn near center', () => {
    expect(spawnDensityWeight(1)).toBeGreaterThan(spawnDensityWeight(0));
    expect(proximityFromCenter(0)).toBe(1);
    expect(proximityFromCenter(1)).toBe(0);
  });

  it('keeps player spawn clearance at least 10 tiles', () => {
    expect(playerSpawnClearancePx(16)).toBeGreaterThanOrEqual(160);
    expect(isWithinRadiusPx(0, 0, 100, 0, 120)).toBe(true);
    expect(isWithinRadiusPx(0, 0, 200, 0, 120)).toBe(false);
  });
});

describe('resources / loot', () => {
  it('gives larger stacks near center (legacy helper)', () => {
    expect(resourceAmountForProximity(1)).toBeGreaterThanOrEqual(
      resourceAmountForProximity(0),
    );
  });

  it('is denser near center', () => {
    expect(resourceDensityWeight(1)).toBeGreaterThan(resourceDensityWeight(0));
  });

  it('picks scrap far from center with high probability', () => {
    let scrap = 0;
    for (let i = 0; i < 200; i += 1)
      scrap += pickResourceId(0, () => 0.99) === 'scrap' ? 1 : 0;
    expect(scrap).toBe(200);
  });

  it('maps loot totals in bands of 10', () => {
    expect(rarityFromLootRoll(1)).toBe('common');
    expect(rarityFromLootRoll(10)).toBe('common');
    expect(rarityFromLootRoll(11)).toBe('uncommon');
    expect(rarityFromLootRoll(20)).toBe('uncommon');
    expect(rarityFromLootRoll(21)).toBe('rare');
    expect(rarityFromLootRoll(31)).toBe('super_rare');
    expect(rarityFromLootRoll(41)).toBe('ultra_rare');
    expect(rarityFromLootRoll(51)).toBe('top_secret');
    const loot = rollLoot(() => 0);
    expect(loot.rarity).toBe('common');
    expect(LOOT_POOLS.common).toContain(loot.itemId);
  });

  it('loot presence scales rural → center (POI 70–95%, carros 35–50%)', () => {
    expect(LOOT_PRESENCE_CHANCE).toBe(0.7);
    expect(LOOT_PRESENCE_CHANCE_CENTER).toBe(0.95);
    expect(CAR_LOOT_PRESENCE_CHANCE).toBe(0.35);
    expect(CAR_LOOT_PRESENCE_CHANCE_CENTER).toBe(0.5);
    expect(lootPresenceChance('backpack', 0)).toBe(0.7);
    expect(lootPresenceChance('backpack', 1)).toBe(0.95);
    expect(lootPresenceChance('wrecked_car', 0)).toBe(0.35);
    expect(lootPresenceChance('wrecked_car', 1)).toBe(0.5);
    expect(lootPresenceChance('abandoned_car', 0.5)).toBeCloseTo(0.425);
    expect(SURVIVAL_SENSE_RADIUS_MULT).toBe(1.5);
    expect(LOOT_SEARCH_MS).toBe(5_000);
    expect(SURVIVAL_SENSE_COOLDOWN_MS).toBe(120_000);
  });
});

describe('inventory', () => {
  it('stacks items and tracks weight up to max', () => {
    const inv = new Inventory();
    expect(inv.tryAdd('scrap', 3)).toEqual({ ok: true, added: 3 });
    expect(inv.totalWeight).toBe(3 * ITEMS.scrap.weight);
    expect(inv.slots[0]?.qty).toBe(3);

    const fill = inv.tryAdd('supplies', 20);
    expect(fill.ok).toBe(false);
    expect(inv.totalWeight).toBeLessThanOrEqual(MAX_CARRY_WEIGHT);
  });

  it('rejects when overweight with empty room for heavier item', () => {
    const inv = new Inventory(8, 2);
    expect(inv.tryAdd('scrap', 2).ok).toBe(true);
    expect(inv.tryAdd('rare_parts', 1)).toEqual({
      ok: false,
      reason: 'overweight',
      added: 0,
    });
  });
});
