import { describe, expect, it } from 'vitest';
import {
  CORPSE_EAT_COOLDOWN_SEC,
  CORPSE_EAT_MAX_SEC,
  CORPSE_EAT_MIN_SEC,
  CorpseIndex,
  corpseEatDurationSec,
  corpseEatRadiusPx,
  MAX_CORPSE_EATERS,
} from '../../src/game/combat/CorpseIndex';
import { ZOMBIE_VISION_HALF_ANGLE } from '../../src/game/combat/visionCone';
import type { City } from '../../src/world/model/types';

function mockCityWithCorpses(
  corpses: { id: string; x: number; y: number }[],
): City {
  return {
    tileSize: 32,
    explorationPoints: corpses.map((c) => ({
      id: c.id,
      typeId: 'corpse',
      x: c.x,
      y: c.y,
      loot: [],
    })),
  } as City;
}

describe('CorpseIndex', () => {
  it('indexes corpse POIs in world pixels', () => {
    const index = CorpseIndex.fromCity(
      mockCityWithCorpses([{ id: 'c1', x: 10, y: 5 }]),
    );
    expect(index.count).toBe(1);
    const hit = index.findNearest(10 * 32 + 16, 5 * 32 + 16, 8);
    expect(hit?.corpse.id).toBe('c1');
    expect(hit?.dist).toBeCloseTo(0, 1);
  });

  it('finds corpse inside vision cone ahead', () => {
    const index = CorpseIndex.fromCity(
      mockCityWithCorpses([{ id: 'c1', x: 10, y: 5 }]),
    );
    const ts = 32;
    const cx = 10 * ts + ts / 2;
    const cy = 5 * ts + ts / 2;
    const ox = cx - 80;
    const oy = cy;
    const hit = index.findInVisionCone(
      ox,
      oy,
      0,
      120,
      ZOMBIE_VISION_HALF_ANGLE,
      null,
    );
    expect(hit?.id).toBe('c1');
  });

  it('ignores corpse outside vision cone', () => {
    const index = CorpseIndex.fromCity(
      mockCityWithCorpses([{ id: 'c1', x: 10, y: 5 }]),
    );
    const ts = 32;
    const cx = 10 * ts + ts / 2;
    const cy = 5 * ts + ts / 2;
    const hit = index.findInVisionCone(
      cx - 80,
      cy,
      Math.PI,
      120,
      ZOMBIE_VISION_HALF_ANGLE,
      null,
    );
    expect(hit).toBeNull();
  });

  it('stable eat duration per enemy and corpse (até 30 s)', () => {
    const a = corpseEatDurationSec('e1', 'c1');
    const b = corpseEatDurationSec('e1', 'c1');
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(CORPSE_EAT_MIN_SEC);
    expect(a).toBeLessThanOrEqual(CORPSE_EAT_MAX_SEC);
  });

  it('cooldown de 60 s antes de voltar a comer', () => {
    expect(CORPSE_EAT_COOLDOWN_SEC).toBe(60);
  });

  it('caps eaters per corpse at five', () => {
    expect(MAX_CORPSE_EATERS).toBe(5);
  });

  it('scales eat radius with tile size', () => {
    expect(corpseEatRadiusPx(32)).toBeGreaterThan(0);
  });
});
