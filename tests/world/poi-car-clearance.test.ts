import { describe, expect, it } from 'vitest';
import {
  isCarPoiType,
  poiConflictsWithCars,
  POI_CAR_CLEARANCE_TILES,
} from '../../src/world/pipeline/poiCarClearance';

describe('poiCarClearance', () => {
  const city = {
    ambientProps: [{ id: 'amb1', kind: 'wrecked_car' as const, x: 10, y: 10, rotation: 0 }],
  } as Parameters<typeof poiConflictsWithCars>[0];

  it('detects car POI types', () => {
    expect(isCarPoiType('abandoned_car')).toBe(true);
    expect(isCarPoiType('crate')).toBe(false);
  });

  it('blocks non-car POIs near car POIs', () => {
    const pois = [{ id: 'c1', typeId: 'abandoned_car', x: 20, y: 20, loot: [] }];
    expect(
      poiConflictsWithCars(city, 20 + POI_CAR_CLEARANCE_TILES - 1, 20, 'crate', pois),
    ).toBe(true);
    expect(
      poiConflictsWithCars(city, 20 + POI_CAR_CLEARANCE_TILES + 2, 20, 'crate', pois),
    ).toBe(false);
  });

  it('blocks non-car POIs near ambient wrecked cars', () => {
    expect(poiConflictsWithCars(city, 10 + 2, 10, 'backpack', [])).toBe(true);
    expect(poiConflictsWithCars(city, 10 + POI_CAR_CLEARANCE_TILES + 2, 10, 'backpack', [])).toBe(
      false,
    );
  });

  it('blocks car POIs near other exploration POIs', () => {
    const pois = [{ id: 'b1', typeId: 'backpack', x: 30, y: 30, loot: [] }];
    expect(poiConflictsWithCars(city, 30 + 2, 30, 'abandoned_car', pois)).toBe(true);
  });
});
