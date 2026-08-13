import { describe, expect, it } from 'vitest';
import {
  OPEN_WORLD_ENEMY_COUNT,
  openWorldEnemyCount,
} from '../../src/game/combat/cityThreat';
import { planEnemySpawns, largestSpawnCluster } from '../../src/game/combat/planEnemySpawns';
import { findSafePlayerSpawn } from '../../src/game/findSafeSpawn';
import { WorldCollision } from '../../src/game/WorldCollision';
import { Rng } from '../../src/world/rng/Rng';
import { generateWorld, getPrimaryCity } from '../../src/world';
import type { CitySizeClass } from '../../src/world/model/types';

describe('planEnemySpawns', () => {
  it('is deterministic for the same city seed', () => {
    const world = generateWorld({
      seed: 424242,
      sizeClass: 'small',
      profileId: 'HeuristicV1',
    });
    const city = getPrimaryCity(world)!;
    const col = new WorldCollision();
    col.rebuild(city);
    const ts = city.tileSize;
    const worldW = city.grid.w * ts;
    const worldH = city.grid.h * ts;
    const spawn = findSafePlayerSpawn(
      city,
      col,
      worldW,
      worldH,
      6,
      { ruralEdgeBandFraction: 0.12 },
    );

    const a = planEnemySpawns(
      city,
      col,
      new Rng(city.seed).fork('enemies'),
      spawn.x,
      spawn.y,
    );
    const b = planEnemySpawns(
      city,
      col,
      new Rng(city.seed).fork('enemies'),
      spawn.x,
      spawn.y,
    );

    expect(a.length).toBeGreaterThan(0);
    expect(a.length).toBe(b.length);
    expect(a[0]).toEqual(b[0]);
  });

  it.each(['small', 'medium', 'large'] as const satisfies readonly CitySizeClass[])(
    'spawns open-world target for %s cities',
    (sizeClass) => {
      const world = generateWorld({
        seed: 991_337,
        sizeClass,
        profileId: 'HeuristicV1',
      });
      const city = getPrimaryCity(world)!;
      const col = new WorldCollision();
      col.rebuild(city);
      const ts = city.tileSize;
      const worldW = city.grid.w * ts;
      const worldH = city.grid.h * ts;
      const target = openWorldEnemyCount(sizeClass);

      const spawn = findSafePlayerSpawn(
        city,
        col,
        worldW,
        worldH,
        6,
        { ruralEdgeBandFraction: 0.12 },
      );

      const spawns = planEnemySpawns(
        city,
        col,
        new Rng(city.seed).fork('enemies'),
        spawn.x,
        spawn.y,
      );

      expect(target).toBe(OPEN_WORLD_ENEMY_COUNT[sizeClass]);
      expect(spawns.length).toBeGreaterThanOrEqual(Math.floor(target * 0.85));
      const core = spawns.filter((s) => s.proximity >= 0.35).length;
      const fringe = spawns.filter((s) => s.proximity < 0.06).length;
      expect(core).toBeGreaterThan(fringe * 3);
      expect(fringe).toBeLessThanOrEqual(Math.ceil(target * 0.08));

      const coreSpawns = spawns.filter((s) => s.proximity >= 0.4);
      const fringeSpawns = spawns.filter((s) => s.proximity < 0.04);
      if (coreSpawns.length > 0) {
        expect(
          largestSpawnCluster(coreSpawns, ts * 14),
        ).toBeGreaterThanOrEqual(Math.min(280, Math.floor(coreSpawns.length * 0.4)));
      }
      if (fringeSpawns.length > 0) {
        expect(largestSpawnCluster(fringeSpawns, ts * 3.5)).toBeLessThanOrEqual(
          12,
        );
      }
    },
    20_000,
  );
});
