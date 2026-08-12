import { describe, expect, it } from 'vitest';
import {
  DAY_VISION_TILES,
  DayNightCycle,
  HALF_DAY_MS,
  NIGHT_VISION_TILES,
  VISION_PENUMBRA_RATIO,
  visionOuterTiles,
} from '../../src/game/DayNightCycle';
import { FogOfWar } from '../../src/game/FogOfWar';
import {
  PISTOL_FIRE_RATE,
  WEAPONS,
} from '../../src/game/combat/weapons';

describe('DayNightCycle', () => {
  it('day vision is double night vision (halved radii)', () => {
    expect(DAY_VISION_TILES).toBe(4);
    expect(NIGHT_VISION_TILES).toBe(2);
    expect(DAY_VISION_TILES).toBe(NIGHT_VISION_TILES * 2);
  });

  it('adds 33% penumbra beyond clear vision', () => {
    expect(VISION_PENUMBRA_RATIO).toBeCloseTo(0.33);
    expect(visionOuterTiles(4)).toBeCloseTo(4 * 1.33);
  });

  it('manual override ignores day/night until cleared', () => {
    const cycle = new DayNightCycle(1000);
    expect(cycle.visionTiles).toBe(DAY_VISION_TILES);
    expect(cycle.visionOuterTiles).toBeCloseTo(
      visionOuterTiles(DAY_VISION_TILES),
    );
    cycle.adjustVision(-1);
    expect(cycle.hasManualVision).toBe(true);
    expect(cycle.visionTiles).toBe(DAY_VISION_TILES - 1);
    cycle.update(1000); // night
    expect(cycle.visionTiles).toBe(DAY_VISION_TILES - 1);
    cycle.clearVisionOverride();
    expect(cycle.visionTiles).toBe(NIGHT_VISION_TILES);
  });

  it('each half lasts 12 minutes; halfPhase01 tracks one lap', () => {
    expect(HALF_DAY_MS).toBe(12 * 60 * 1000);
    const cycle = new DayNightCycle();
    expect(cycle.isDay).toBe(true);
    expect(cycle.halfPhase01).toBe(0);

    cycle.update(HALF_DAY_MS * 0.25);
    expect(cycle.isDay).toBe(true);
    expect(cycle.halfPhase01).toBeCloseTo(0.25);

    cycle.update(HALF_DAY_MS * 0.75);
    expect(cycle.isDay).toBe(false);
    expect(cycle.halfPhase01).toBeCloseTo(0);

    cycle.update(HALF_DAY_MS * 0.5);
    expect(cycle.isDay).toBe(false);
    expect(cycle.halfPhase01).toBeCloseTo(0.5);
  });
});

describe('FogOfWar', () => {
  it('marks explored permanently and visible for current circle', () => {
    const fog = new FogOfWar(40, 40);
    const newly = fog.revealCircle(20, 20, 5);
    expect(newly.length).toBeGreaterThan(10);
    expect(fog.isExplored(20, 20)).toBe(true);
    expect(fog.isVisible(20, 20)).toBe(true);

    fog.revealCircle(20, 20, 2);
    expect(fog.isExplored(20, 24)).toBe(true); // still explored from before
    expect(fog.isVisible(20, 24)).toBe(false); // outside smaller radius
    expect(fog.isVisible(20, 20)).toBe(true);
  });

  it('only returns newly explored indices once', () => {
    const fog = new FogOfWar(20, 20);
    const a = fog.revealCircle(10, 10, 3);
    const b = fog.revealCircle(10, 10, 3);
    expect(a.length).toBeGreaterThan(0);
    expect(b.length).toBe(0);
  });
});

describe('weapon balance', () => {
  it('pistol outdamages knife and fires at 0.33/s', () => {
    expect(WEAPONS.pistol.damageMin).toBe(4);
    expect(WEAPONS.pistol.damageMax).toBe(8);
    expect(WEAPONS.pistol.accuracy).toBeCloseTo(0.72);
    expect(WEAPONS.knife.damageMin).toBe(2);
    expect(WEAPONS.knife.damageMax).toBe(6);
    expect(WEAPONS.knife.damageMax * 2).toBe(12); // backstab crit
    expect(PISTOL_FIRE_RATE).toBeCloseTo(0.33);
    expect(WEAPONS.pistol.cooldownSec).toBeCloseTo(1 / 0.33);
  });
});
