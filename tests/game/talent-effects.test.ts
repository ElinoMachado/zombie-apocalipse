import { describe, expect, it } from 'vitest';
import { PlayerProgression } from '../../src/game/progression/PlayerProgression';
import { talentEffectsFor } from '../../src/game/progression/talentEffects';
import { rollLootWithIntellect } from '../../src/game/resources/lootTable';

describe('TalentEffects', () => {
  it('scales resilient HP and resistant AC by level', () => {
    const p = new PlayerProgression(() => 0);
    p.talents.resiliente = 3;
    p.talents.resistente = 2;
    const fx = talentEffectsFor(p);
    expect(fx.resilientBonusHp()).toBe(12);
    expect(fx.resistantBonusAc()).toBe(3);
    expect(fx.playerAcTotal(10)).toBe(13);
  });

  it('adds combat bonuses for ranged and melee talents', () => {
    const p = new PlayerProgression(() => 0);
    p.talents.tiro_pesado = 4;
    p.talents.golpe_pesado = 5;
    p.talents.olhos_de_aguia = 3;
    const fx = talentEffectsFor(p);
    expect(fx.rangedDamageBonus()).toBe(12);
    expect(fx.meleeDamageBonus()).toBe(50);
    expect(fx.rangedHitBonus()).toBe(6);
    expect(fx.rangedAutoHit()).toBe(false);
    p.talents.olhos_de_aguia = 6;
    expect(talentEffectsFor(p).rangedAutoHit()).toBe(true);
  });

  it('projectile pierce and vision bonus scale', () => {
    const p = new PlayerProgression(() => 0);
    p.talents.projeteis_penetrantes = 2;
    p.talents.visao_aprimorada = 6;
    const fx = talentEffectsFor(p);
    expect(fx.projectilePierceExtra()).toBe(2);
    expect(fx.visionBonusTiles()).toBe(12);
  });

  it('loot mods from explorador talents', () => {
    const p = new PlayerProgression(() => 0);
    p.talents.explorador = 2;
    p.talents.explorador_nato = 3;
    const mods = talentEffectsFor(p).lootMods();
    expect(mods.rollBonus).toBe(2);
    expect(mods.rarityBump).toBe(2);
    expect(mods.crit19).toBe(true);
  });

  it('mitigates incoming damage from resistente', () => {
    const p = new PlayerProgression(() => 0);
    p.talents.resistente = 5;
    const fx = talentEffectsFor(p);
    expect(fx.mitigateIncomingDamage(10)).toBeLessThan(10);
    expect(fx.mitigateIncomingDamage(10)).toBeGreaterThanOrEqual(1);
  });

  it('rollAttack supports advantage and auto hit', () => {
    const fx = talentEffectsFor(new PlayerProgression(() => 0));
    expect(fx.rollAttack(0, 30, { autoHit: true }).hit).toBe(true);
    let hits = 0;
    for (let i = 0; i < 50; i += 1) {
      if (fx.rollAttack(5, 10, { advantage: true }, () => 0.95).hit) hits += 1;
    }
    expect(hits).toBe(50);
  });
});

describe('loot with talent mods', () => {
  it('applies roll bonus and rarity bump', () => {
    const rolls = rollLootWithIntellect(10, () => 0.5, {
      rollBonus: 5,
      rarityBump: 1,
      crit19: false,
    });
    expect(rolls[0]!.total).toBeGreaterThanOrEqual(15);
  });
});
