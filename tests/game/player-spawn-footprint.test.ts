import { describe, expect, it } from 'vitest';
import { FireHazards } from '../../src/game/FireHazards';
import {
  isPlayerSpawnClear,
  playerSpawnFootprintRadius,
  reservePlayerSpawnFootprint,
} from '../../src/game/playerSpawnFootprint';
import { findSafePlayerSpawn } from '../../src/game/findSafeSpawn';
import { WorldCollision } from '../../src/game/WorldCollision';
import { generateWorld, getPrimaryCity } from '../../src/world';

describe('player spawn footprint', () => {
  it('rejects spawn overlapping fire or props', () => {
    const city = {
      tileSize: 32,
      explorationPoints: [],
      ambientProps: [
        { id: 'f1', kind: 'burning_debris', x: 5, y: 5, rotation: 0 },
      ],
      structures: [],
      grid: { w: 20, h: 20 },
      roadGrid: new Array(400).fill('highway'),
      zoneGrid: new Array(400).fill('rural'),
    } as never;
    const col = new WorldCollision();
    col.rebuild(city);
    const px = 5 * 32 + 16;
    const py = 5 * 32 + 16;
    expect(isPlayerSpawnClear(city, col, px, py, 6)).toBe(false);
  });

  it('clears props and pois at reserved spawn', () => {
    const city = {
      tileSize: 32,
      explorationPoints: [
        { id: 'p1', typeId: 'crate', x: 8, y: 8, loot: [] },
      ],
      ambientProps: [
        { id: 'a1', kind: 'debris', x: 8, y: 8, rotation: 0 },
      ],
      structures: [],
      grid: { w: 20, h: 20 },
      roadGrid: new Array(400).fill('highway'),
      zoneGrid: new Array(400).fill('rural'),
    } as never;
    const px = 8 * 32 + 16;
    const py = 8 * 32 + 16;
    reservePlayerSpawnFootprint(city, px, py, 6);
    expect(city.explorationPoints).toHaveLength(0);
    expect(city.ambientProps).toHaveLength(0);
  });

  it('findSafePlayerSpawn avoids fire and reserves empty tile', () => {
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
    const radius = 6;
    const spawn = findSafePlayerSpawn(city, col, worldW, worldH, radius, {
      ruralEdgeBandFraction: 0.12,
      marginTilesX: 8,
      marginTilesY: 8,
    });
    col.rebuild(city);
    const fires = new FireHazards();
    fires.setFromCity(city.ambientProps, ts);

    expect(isPlayerSpawnClear(city, col, spawn.x, spawn.y, radius)).toBe(true);
    expect(fires.touches(spawn.x, spawn.y, radius)).toBe(false);
    expect(playerSpawnFootprintRadius(radius, ts)).toBeGreaterThan(radius);
  });
});
