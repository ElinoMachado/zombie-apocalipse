import { describe, expect, it } from 'vitest';
import { deriveSeed, Rng } from '../../src/world/rng/Rng';
import {
  fromSamples,
  sampleDistribution,
  dist,
} from '../../src/world/stats';
import {
  generateWorld,
  getPrimaryCity,
  getDefaultProfileId,
  HeuristicV1,
} from '../../src/world';

describe('Rng', () => {
  it('is deterministic for the same seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('deriveSeed is stable', () => {
    expect(deriveSeed(1, 'roads')).toBe(deriveSeed(1, 'roads'));
    expect(deriveSeed(1, 'roads')).not.toBe(deriveSeed(1, 'zones'));
  });
});

describe('Distribution', () => {
  it('fromSamples computes percentiles', () => {
    const d = fromSamples([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], { confidence: 1 });
    expect(d.sampleSize).toBe(10);
    expect(d.p50).toBeCloseTo(5.5, 5);
    expect(d.p10).toBeLessThan(d.p50);
    expect(d.p90).toBeGreaterThan(d.p50);
  });

  it('sampleDistribution is deterministic with Rng', () => {
    const d = dist({ p50: 10, p25: 8, p75: 12, p10: 6, p90: 14 });
    const a = new Rng(99);
    const b = new Rng(99);
    const sa = Array.from({ length: 30 }, () => sampleDistribution(a, d));
    const sb = Array.from({ length: 30 }, () => sampleDistribution(b, d));
    expect(sa).toEqual(sb);
  });
});

describe('generateWorld', () => {
  it('uses HeuristicV1 by default', () => {
    expect(getDefaultProfileId()).toBe(HeuristicV1.id);
    const world = generateWorld({
      seed: 829173,
      sizeClass: 'small',
      profileId: 'HeuristicV1',
    });
    const city = getPrimaryCity(world);
    expect(city?.profileId).toBe('HeuristicV1');
    expect(city?.structures.length).toBeGreaterThan(0);
  });

  it('same seed + profile + size → same summary shape', () => {
    const a = getPrimaryCity(
      generateWorld({ seed: 111, sizeClass: 'small', profileId: 'HeuristicV1' }),
    );
    const b = getPrimaryCity(
      generateWorld({ seed: 111, sizeClass: 'small', profileId: 'HeuristicV1' }),
    );
    expect(a?.name).toBe(b?.name);
    expect(a?.lots.length).toBe(b?.lots.length);
    expect(a?.structures.length).toBe(b?.structures.length);
    expect(a?.roads.length).toBe(b?.roads.length);
  });

  it('OSM profile changes road layout vs HeuristicV1 at same seed', () => {
    const seed = 424242;
    const h = getPrimaryCity(
      generateWorld({ seed, sizeClass: 'medium', profileId: 'HeuristicV1' }),
    );
    const o = getPrimaryCity(
      generateWorld({
        seed,
        sizeClass: 'medium',
        profileId: 'BrazilianMediumCity',
      }),
    );
    expect(o?.profileId).toBe('BrazilianMediumCity');
    expect(o?.roads.length).toBeGreaterThan(0);
    // hierarchyWeights / regularity should diverge topology
    expect(o?.roads.length).not.toBe(h?.roads.length);
  });
});
