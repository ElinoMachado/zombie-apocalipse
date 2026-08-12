import { describe, expect, it } from 'vitest';
import { injectDevPoiShowcaseNearSpawn } from '../../src/game/dev/injectDevPoiShowcase';
import { findSafePlayerSpawn } from '../../src/game/findSafeSpawn';
import { WorldCollision } from '../../src/game/WorldCollision';
import { getExplorations } from '../../src/world/catalog/structures';
import { generateWorld, getPrimaryCity } from '../../src/world';

describe('injectDevPoiShowcaseNearSpawn', () => {
  it('places one of each exploration POI near the player spawn', () => {
    const world = generateWorld({
      seed: 4242,
      sizeClass: 'medium',
      profileId: 'HeuristicV1',
    });
    const city = getPrimaryCity(world)!;
    const col = new WorldCollision();
    col.rebuild(city);
    const ts = city.tileSize;
    const worldW = city.grid.w * ts;
    const worldH = city.grid.h * ts;
    const spawn = findSafePlayerSpawn(city, col, worldW, worldH, 6, {
      ruralEdgeBandFraction: 0.12,
      marginTilesX: 8,
      marginTilesY: 8,
    });

    const expectedTypes = getExplorations().map((d) => d.id);
    const added = injectDevPoiShowcaseNearSpawn(city, spawn.x, spawn.y);
    expect(added).toBe(expectedTypes.length);

    const showcase = city.explorationPoints.filter((p) =>
      p.id.startsWith('dev_showcase_'),
    );
    expect(showcase).toHaveLength(expectedTypes.length);

    const typeSet = new Set(showcase.map((p) => p.typeId));
    for (const typeId of expectedTypes) {
      expect(typeSet.has(typeId)).toBe(true);
    }

    const maxDistPx = ts * 24;
    for (const poi of showcase) {
      const px = poi.x * ts + ts / 2;
      const py = poi.y * ts + ts / 2;
      expect(Math.hypot(px - spawn.x, py - spawn.y)).toBeLessThanOrEqual(
        maxDistPx,
      );
    }
  });
});
