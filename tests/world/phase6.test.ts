import { describe, expect, it } from 'vitest';
import { ANCHOR_QUOTAS } from '../../src/world/catalog/structures';
import {
  compareCityToProfile,
  generateWorld,
  getPrimaryCity,
  getProfile,
  HeuristicV1,
  resolveAnchorQuotas,
} from '../../src/world';

describe('resolveAnchorQuotas', () => {
  it('applies HeuristicV1 maxPerCityBySize caps', () => {
    const capped = resolveAnchorQuotas(
      ANCHOR_QUOTAS.small,
      HeuristicV1,
      'small',
    );
    expect(capped.hospital).toBe(0);
    expect(capped.school).toBe(1);
    expect(capped.farm).toBe(1);
  });
});

describe('poiRules + profile fit', () => {
  it('HeuristicV1 small places no hospital (quota 0)', () => {
    const city = getPrimaryCity(
      generateWorld({
        seed: 55,
        sizeClass: 'small',
        profileId: 'HeuristicV1',
      }),
    );
    expect(city?.structures.some((s) => s.typeId === 'hospital')).toBe(false);
  });

  it('compareCityToProfile reports metrics for BrazilianMediumCity', () => {
    const world = generateWorld({
      seed: 9001,
      sizeClass: 'medium',
      profileId: 'BrazilianMediumCity',
    });
    const city = getPrimaryCity(world)!;
    const profile = getProfile('BrazilianMediumCity');
    const fit = compareCityToProfile(city, profile);
    expect(fit.profileId).toBe('BrazilianMediumCity');
    expect(fit.meanLotArea).toBeGreaterThan(20);
    expect(fit.hierarchyL1).toBeGreaterThanOrEqual(0);
    expect(fit.emptyLotRate).toBeGreaterThanOrEqual(0);
    expect(fit.emptyLotRate).toBeLessThanOrEqual(1);
  });
});
