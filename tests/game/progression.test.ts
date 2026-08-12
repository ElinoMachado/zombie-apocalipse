import { describe, expect, it } from 'vitest';
import {
  attributeModifier,
  playerAC,
  vitalityHpBonus,
} from '../../src/game/progression/attributes';
import { PlayerProgression, XP_REWARDS, MAX_LEVEL } from '../../src/game/progression/PlayerProgression';
import {
  bumpRarityUp,
  rarityFromLootTotal,
  rollLootWithIntellect,
} from '../../src/game/resources/lootTable';

describe('attributes', () => {
  it('uses D&D modifier from score 10 base', () => {
    expect(attributeModifier(10)).toBe(0);
    expect(attributeModifier(12)).toBe(1);
    expect(attributeModifier(14)).toBe(2);
    expect(attributeModifier(8)).toBe(-1);
  });

  it('adds reflex mod to base AC 10', () => {
    expect(playerAC(10)).toBe(10);
    expect(playerAC(14)).toBe(12);
  });

  it('vitality bonus is mod × level', () => {
    expect(vitalityHpBonus(14, 10)).toBe(20);
    expect(vitalityHpBonus(18, 14)).toBe(56);
  });
});

describe('PlayerProgression', () => {
  it('grants 2 attribute points per level and talent on even levels', () => {
    const p = new PlayerProgression(() => 0);
    expect(p.level).toBe(1);
    const ups = p.grantRawXp(p.xpToNextLevel());
    expect(ups).toHaveLength(1);
    expect(ups[0]!.newLevel).toBe(2);
    expect(p.attributePoints).toBe(2);
    expect(p.talentPoints).toBe(1);
  });

  it('caps at level 20', () => {
    const p = new PlayerProgression(() => 0);
    for (let i = 0; i < 30; i += 1) p.grantRawXp(9999);
    expect(p.level).toBe(MAX_LEVEL);
  });

  it('xp weights favor kills over loot over craft', () => {
    expect(XP_REWARDS.kill_zombie).toBeGreaterThan(XP_REWARDS.loot_search);
    expect(XP_REWARDS.loot_search).toBeGreaterThan(XP_REWARDS.craft);
    expect(XP_REWARDS.craft).toBeGreaterThan(XP_REWARDS.miscellaneous);
  });

  it('spends talent points to learn and upgrade to nv6', () => {
    const p = new PlayerProgression(() => 0);
    p.talentPoints = 3;
    expect(p.spendTalentPoint('golpe_pesado')).toBe(true);
    expect(p.getTalentLevel('golpe_pesado')).toBe(1);
    expect(p.spendTalentPoint('golpe_pesado')).toBe(true);
    expect(p.getTalentLevel('golpe_pesado')).toBe(2);
    expect(p.talentPoints).toBe(1);
    expect(p.spendTalentPoint('golpe_pesado')).toBe(true);
    expect(p.getTalentLevel('golpe_pesado')).toBe(3);
    expect(p.listOwnedTalents()).toHaveLength(1);
  });
});

describe('loot intellect', () => {
  it('maps totals in bands of 10', () => {
    expect(rarityFromLootTotal(10)).toBe('common');
    expect(rarityFromLootTotal(11)).toBe('uncommon');
    expect(rarityFromLootTotal(21)).toBe('rare');
    expect(rarityFromLootTotal(31)).toBe('super_rare');
    expect(rarityFromLootTotal(41)).toBe('ultra_rare');
    expect(rarityFromLootTotal(51)).toBe('top_secret');
  });

  it('natural 20 bumps rarity one tier', () => {
    let n = 0;
    const rng = () => {
      n += 1;
      return n === 1 ? 0.95 : 0; // d20 = 20
    };
    const rolls = rollLootWithIntellect(10, rng);
    expect(rolls[0]!.naturalRoll).toBe(20);
    expect(rolls[0]!.total).toBe(20);
    expect(rolls[0]!.rarity).toBe(bumpRarityUp('uncommon'));
  });

  it('adds extra items every 5 intellect mod', () => {
    const rolls = rollLootWithIntellect(20, () => 0.5);
    expect(rolls.length).toBe(2);
  });
});
