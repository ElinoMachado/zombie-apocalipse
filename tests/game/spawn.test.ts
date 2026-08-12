import { describe, expect, it } from 'vitest';
import {
  cameraSafeMarginTiles,
  findHighwaySpawnOutsideCity,
} from '../../src/game/findHighwaySpawn';
import { generateWorld, getPrimaryCity } from '../../src/world';
import { isUrbanCell } from '../../src/world/pipeline/urbanFootprint';

describe('highway spawn outside city', () => {
  it('picks a highway cell outside urban and away from map edge', () => {
    const world = generateWorld({
      seed: 123,
      sizeClass: 'small',
      profileId: 'HeuristicV1',
    });
    const city = getPrimaryCity(world)!;
    const margins = cameraSafeMarginTiles(1280, 720, 3.5, city.tileSize);
    const spawn = findHighwaySpawnOutsideCity(city, {
      ruralEdgeBandFraction: 0.12,
      ...margins,
    });
    expect(spawn).not.toBeNull();
    const { x, y } = spawn!;
    const { w, h } = city.grid;
    expect(city.roadGrid[y * w + x]).toBe('highway');
    expect(isUrbanCell(city, x, y, 0.12, 0)).toBe(false);
    expect(x).toBeGreaterThanOrEqual(margins.marginTilesX);
    expect(x).toBeLessThan(w - margins.marginTilesX);
    expect(y).toBeGreaterThanOrEqual(margins.marginTilesY);
    expect(y).toBeLessThan(h - margins.marginTilesY);
  });
});
