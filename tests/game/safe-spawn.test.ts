import { describe, expect, it } from 'vitest';
import { findSafePlayerSpawn } from '../../src/game/findSafeSpawn';
import { WorldCollision } from '../../src/game/WorldCollision';
import { generateWorld, getPrimaryCity } from '../../src/world';

describe('safe player spawn', () => {
  it('never spawns overlapping collision solids', () => {
    const world = generateWorld({
      seed: 9001,
      sizeClass: 'medium',
      profileId: 'HeuristicV1',
    });
    const city = getPrimaryCity(world)!;
    const col = new WorldCollision();
    col.rebuild(city);
    const ts = city.tileSize;
    const worldW = city.grid.w * ts;
    const worldH = city.grid.h * ts;
    const radius = 6;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const spawn = findSafePlayerSpawn(
        city,
        col,
        worldW,
        worldH,
        radius,
        { ruralEdgeBandFraction: 0.12, marginTilesX: 8, marginTilesY: 8 },
      );
      expect(col.hits({ x: spawn.x, y: spawn.y, radius })).toBe(false);
      expect(spawn.x).toBeGreaterThanOrEqual(radius);
      expect(spawn.y).toBeGreaterThanOrEqual(radius);
      expect(spawn.x).toBeLessThanOrEqual(worldW - radius);
      expect(spawn.y).toBeLessThanOrEqual(worldH - radius);
    }
  });

  it('resolveSpawnPosition finds a free ring around a blocked point', () => {
    const col = new WorldCollision();
    col.loadSolids([{ x: 90, y: 90, w: 20, h: 20 }]);
    const blocked = col.resolveSpawnPosition(100, 100, 6, 256, 256, 64, 8);
    expect(col.hits({ x: blocked.x, y: blocked.y, radius: 6 })).toBe(false);
    expect(Math.hypot(blocked.x - 100, blocked.y - 100)).toBeGreaterThan(0);
  });
});
