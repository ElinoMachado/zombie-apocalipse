import { describe, expect, it } from 'vitest';
import {
  LOOT_POOLS,
  pickLootItemForRarity,
  pickLootItemForSite,
} from '../../src/game/resources/lootPools';
import { ITEMS } from '../../src/game/inventory/inventory';
import { rollLoot } from '../../src/game/resources/lootTable';

describe('loot pools from catalog', () => {
  it('includes real catalog items per rarity, not legacy placeholders', () => {
    expect(LOOT_POOLS.common).toContain('bottled_water');
    expect(LOOT_POOLS.common).toContain('bandage');
    expect(LOOT_POOLS.common).toContain('cloth');
    expect(LOOT_POOLS.common).not.toContain('scrap');
    expect(LOOT_POOLS.uncommon).toContain('basic_medkit');
    expect(LOOT_POOLS.rare.length).toBeGreaterThan(0);
    expect(LOOT_POOLS.top_secret).toContain('experimental_nanomed');
  });

  it('corpse sites favour cloth drops', () => {
    let cloth = 0;
    for (let i = 0; i < 100; i += 1) {
      if (pickLootItemForSite('corpse', 'common', () => 0.1) === 'cloth') cloth += 1;
    }
    expect(cloth).toBeGreaterThan(50);

    expect(pickLootItemForSite('zombie_corpse', 'common', () => 0)).toBe('cloth');
    expect(pickLootItemForSite('backpack', 'common', () => 0)).not.toBe('cloth');
  });

  it('pickLootItemForRarity returns item matching pool tier', () => {
    const id = pickLootItemForRarity('common', () => 0);
    expect(LOOT_POOLS.common).toContain(id);
    expect(ITEMS[id].category).not.toBe('legacy');
  });

  it('rollLoot uses catalog pool for common tier', () => {
    const loot = rollLoot(() => 0);
    expect(loot.rarity).toBe('common');
    expect(LOOT_POOLS.common).toContain(loot.itemId);
  });
});
