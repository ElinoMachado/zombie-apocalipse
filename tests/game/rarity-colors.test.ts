import { describe, expect, it } from 'vitest';
import { RARITY_COLOR, RARITY_ORDER } from '../../src/game/inventory/itemTypes';

describe('rarity colors', () => {
  it('maps tiers to white → green → blue → purple → orange → red', () => {
    expect(RARITY_COLOR.common).toBe(0xffffff);
    expect(RARITY_COLOR.uncommon).toBe(0x4ade80);
    expect(RARITY_COLOR.rare).toBe(0x3b82f6);
    expect(RARITY_COLOR.super_rare).toBe(0xa855f7);
    expect(RARITY_COLOR.ultra_rare).toBe(0xf97316);
    expect(RARITY_COLOR.top_secret).toBe(0xef4444);
  });

  it('covers every ordered rarity tier', () => {
    for (const r of RARITY_ORDER) {
      expect(RARITY_COLOR[r]).toBeDefined();
    }
  });
});
