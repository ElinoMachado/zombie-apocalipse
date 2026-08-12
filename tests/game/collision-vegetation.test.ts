import { describe, expect, it } from 'vitest';
import {
  collectWreckedCarObbs,
  circleHitsCarObb,
  wreckedCarCollisionRect,
} from '../../src/assets/wreckedCars';
import { WorldCollision } from '../../src/game/WorldCollision';
import { generateWorld, getPrimaryCity } from '../../src/world';

describe('collision', () => {
  it('builds solid blockers for structures', () => {
    const world = generateWorld({
      seed: 4242,
      sizeClass: 'small',
      profileId: 'HeuristicV1',
    });
    const city = getPrimaryCity(world)!;

    const col = new WorldCollision();
    col.rebuild(city);
    expect(col.solidCount).toBeGreaterThan(0);

    const house = city.structures.find(
      (s) => s.category === 'primary' && !s.typeId.includes('parking'),
    );
    expect(house).toBeTruthy();
    const ts = city.tileSize;
    const hx = house!.bounds.x * ts + (house!.bounds.w * ts) / 2;
    const hy = house!.bounds.y * ts + (house!.bounds.h * ts) / 2;
    expect(col.hits({ x: hx, y: hy, radius: 4 })).toBe(true);
    expect(col.hits({ x: 4, y: 4, radius: 4 })).toBe(false);
  });

  it('blocks movement and line of sight through wrecked cars', () => {
    const world = generateWorld({
      seed: 9001,
      sizeClass: 'medium',
      profileId: 'HeuristicV1',
    });
    const city = getPrimaryCity(world)!;
    const car = city.ambientProps.find((p) => p.kind === 'wrecked_car');
    expect(car).toBeTruthy();

    const col = new WorldCollision();
    col.rebuild(city);
    const ts = city.tileSize;
    const cx = car!.x * ts + ts / 2;
    const cy = car!.y * ts + ts / 2;

    expect(col.hits({ x: cx, y: cy, radius: 6 })).toBe(true);

    const beyond = cx + ts * 8;
    expect(col.hasLineOfSight(cx - ts * 6, cy, beyond, cy)).toBe(false);
    expect(col.hasLineOfSight(cx - ts * 6, cy, cx - ts * 2, cy)).toBe(true);
  });

  it('includes abandoned car POIs in collision solids', () => {
    const ts = 12;
    const col = new WorldCollision();
    col.loadCarObbs(
      collectWreckedCarObbs({
        tileSize: ts,
        ambientProps: [],
        explorationPoints: [
          {
            id: 'poi-test',
            typeId: 'abandoned_car',
            x: 4,
            y: 3,
          },
        ],
      }),
    );
    const cx = 4 * ts + ts / 2;
    const cy = 3 * ts + ts / 2;
    expect(col.solidCount).toBe(1);
    expect(col.hits({ x: cx, y: cy, radius: 4 })).toBe(true);
  });
});
