import type { City } from '../../world/model/types';
import type { Rng } from '../../world/rng/Rng';
import type { WorldCollision } from '../WorldCollision';
import {
  centerDistanceNorm,
  enemyDamageRange,
  enemyHpForProximity,
  enemySpacingPx,
  openWorldEnemyCount,
  pickCenterBiasedTile,
  playerSpawnClearancePx,
  proximityFromCenter,
} from './cityThreat';
import { SpawnSpacingGrid } from './spawnSpacingGrid';

export interface PlannedEnemySpawn {
  x: number;
  y: number;
  proximity: number;
  maxHp: number;
  damageMin: number;
  damageMax: number;
}

/** Anéis do centro → rural; shares somam 1. Hordas concentradas por anel. */
export const ENEMY_BANDS = [
  {
    minProx: 0.4,
    maxProx: 1.01,
    share: 0.55,
    hordeMax: 400,
    hordeMin: 280,
    intraSepTiles: 0.3,
    hordeGapTiles: 2.5,
  },
  {
    minProx: 0.15,
    maxProx: 0.4,
    share: 0.3,
    hordeMax: 90,
    hordeMin: 45,
    intraSepTiles: 0.55,
    hordeGapTiles: 3.5,
  },
  {
    minProx: 0.04,
    maxProx: 0.15,
    share: 0.11,
    hordeMax: 28,
    hordeMin: 12,
    intraSepTiles: 0.9,
    hordeGapTiles: 5.5,
  },
  {
    minProx: 0,
    maxProx: 0.04,
    share: 0.04,
    hordeMax: 10,
    hordeMin: 4,
    intraSepTiles: 1.15,
    hordeGapTiles: 9,
  },
] as const;

export type EnemyDensityBand = (typeof ENEMY_BANDS)[number];

/** Fração em hordas vs espalhados (estes tendem a POIs de loot). */
export const HORDE_POPULATION_FRACTION = 0.67;
export const STRAY_POPULATION_FRACTION = 0.33;

/**
 * Calcula posições iniciais dos inimigos (mesma lógica do spawn real).
 */
export function planEnemySpawns(
  city: City,
  collision: WorldCollision,
  rng: Rng,
  playerSpawnX?: number,
  playerSpawnY?: number,
): PlannedEnemySpawn[] {
  const ts = city.tileSize;
  const spawnClear =
    playerSpawnX != null && playerSpawnY != null
      ? playerSpawnClearancePx(ts)
      : null;
  const cx = city.center.x;
  const cy = city.center.y;
  const targetCount = openWorldEnemyCount(city.sizeClass);
  const pois = city.explorationPoints;

  const spawns: PlannedEnemySpawn[] = [];
  const spacingGrid = new SpawnSpacingGrid(Math.max(6, Math.floor(ts * 0.45)));

  for (let b = 0; b < ENEMY_BANDS.length; b += 1) {
    const band = ENEMY_BANDS[b]!;
    const bandTarget = Math.round(targetCount * band.share);
    const hordeTarget = Math.round(bandTarget * HORDE_POPULATION_FRACTION);
    const strayTarget = bandTarget - hordeTarget;
    const spacingScale = b === 0 ? 0.95 : b === ENEMY_BANDS.length - 1 ? 1.05 : 1;
    fillEnemyBand({
      band,
      bandTarget: hordeTarget,
      spacingScale,
      city,
      collision,
      rng,
      pois,
      cx,
      cy,
      ts,
      spawnClear,
      playerSpawnX,
      playerSpawnY,
      spawns,
      spacingGrid,
    });
    fillStrayInBand({
      band,
      strayTarget,
      spacingScale,
      city,
      collision,
      rng,
      pois,
      cx,
      cy,
      ts,
      spawnClear,
      playerSpawnX,
      playerSpawnY,
      spawns,
      spacingGrid,
    });
  }

  for (const spacingScale of [0.55, 0.4]) {
    if (spawns.length >= targetCount) break;
    const need = targetCount - spawns.length;
    const hordeTopUp = Math.round(need * HORDE_POPULATION_FRACTION);
    fillEnemyBand({
      band: ENEMY_BANDS[0]!,
      bandTarget: hordeTopUp,
      spacingScale,
      city,
      collision,
      rng,
      pois,
      cx,
      cy,
      ts,
      spawnClear,
      playerSpawnX,
      playerSpawnY,
      spawns,
      spacingGrid,
    });
    if (spawns.length >= targetCount) break;
    fillStrayInBand({
      band: ENEMY_BANDS[0]!,
      strayTarget: Math.max(0, need - hordeTopUp),
      spacingScale,
      city,
      collision,
      rng,
      pois,
      cx,
      cy,
      ts,
      spawnClear,
      playerSpawnX,
      playerSpawnY,
      spawns,
      spacingGrid,
    });
    if (spawns.length >= targetCount) break;
    const need2 = targetCount - spawns.length;
    const hordeTopUp2 = Math.round(need2 * HORDE_POPULATION_FRACTION);
    fillEnemyBand({
      band: ENEMY_BANDS[1]!,
      bandTarget: hordeTopUp2,
      spacingScale,
      city,
      collision,
      rng,
      pois,
      cx,
      cy,
      ts,
      spawnClear,
      playerSpawnX,
      playerSpawnY,
      spawns,
      spacingGrid,
    });
    if (spawns.length >= targetCount) break;
    fillStrayInBand({
      band: ENEMY_BANDS[1]!,
      strayTarget: Math.max(0, need2 - hordeTopUp2),
      spacingScale,
      city,
      collision,
      rng,
      pois,
      cx,
      cy,
      ts,
      spawnClear,
      playerSpawnX,
      playerSpawnY,
      spawns,
      spacingGrid,
    });
  }

  if (spawnClear != null && playerSpawnX != null && playerSpawnY != null) {
    return cullNearPoint(spawns, playerSpawnX, playerSpawnY, spawnClear);
  }
  return spawns;
}

/** Maior aglomerado num raio (px) — útil em testes. */
export function largestSpawnCluster(
  spawns: readonly PlannedEnemySpawn[],
  radiusPx: number,
): number {
  let best = 0;
  for (const s of spawns) {
    let n = 0;
    const r2 = radiusPx * radiusPx;
    for (const o of spawns) {
      const dx = o.x - s.x;
      const dy = o.y - s.y;
      if (dx * dx + dy * dy <= r2) n += 1;
    }
    if (n > best) best = n;
  }
  return best;
}

function fillEnemyBand(opts: {
  band: EnemyDensityBand;
  bandTarget: number;
  spacingScale: number;
  city: City;
  collision: WorldCollision;
  rng: Rng;
  pois: City['explorationPoints'];
  cx: number;
  cy: number;
  ts: number;
  spawnClear: number | null;
  playerSpawnX?: number;
  playerSpawnY?: number;
  spawns: PlannedEnemySpawn[];
  spacingGrid: SpawnSpacingGrid;
}): number {
  if (opts.bandTarget <= 0) return 0;

  const hordeMax = Math.max(
    2,
    Math.round(opts.band.hordeMax * opts.spacingScale),
  );
  const hordeMin = Math.max(
    2,
    Math.min(hordeMax, Math.round(opts.band.hordeMin * opts.spacingScale)),
  );
  const intraSep = opts.band.intraSepTiles * opts.ts * opts.spacingScale;
  const hordeGap = opts.band.hordeGapTiles * opts.ts * opts.spacingScale;

  let placed = 0;
  let anchorAttempts = 0;
  const maxAnchorAttempts = Math.max(
    Math.ceil(opts.bandTarget / Math.max(hordeMin, 1)) * 35,
    120,
  );

  while (
    placed < opts.bandTarget &&
    anchorAttempts < maxAnchorAttempts
  ) {
    anchorAttempts += 1;
    const anchor = pickAnchorInBand(opts);
    if (!anchor) continue;

    if (opts.spacingGrid.tooClose(anchor.x, anchor.y, hordeGap)) continue;

    const remaining = opts.bandTarget - placed;
    const cap = Math.min(remaining, hordeMax);
    const floor = Math.min(hordeMin, cap);
    const hordeWant = opts.rng.int(floor, cap);
    const clusterRadius = intraSep * Math.sqrt(hordeWant) * 0.95;

    const cluster: PlannedEnemySpawn[] = [];
    const memberAttempts = Math.max(hordeWant * 30, 60);
    for (
      let i = 0;
      i < memberAttempts && cluster.length < hordeWant;
      i += 1
    ) {
      let x: number;
      let y: number;
      if (cluster.length === 0) {
        x = anchor.x;
        y = anchor.y;
      } else {
        const ang = opts.rng.float(0, Math.PI * 2);
        const dist = opts.rng.float(0, clusterRadius);
        x = anchor.x + Math.cos(ang) * dist;
        y = anchor.y + Math.sin(ang) * dist;
      }

      if (
        !canPlaceHordeMember(
          x,
          y,
          anchor.prox,
          opts,
          cluster,
          intraSep,
        )
      ) {
        continue;
      }

      const dmg = enemyDamageRange(anchor.prox);
      cluster.push({
        x,
        y,
        proximity: anchor.prox,
        maxHp: enemyHpForProximity(anchor.prox),
        damageMin: dmg.min,
        damageMax: dmg.max,
      });
    }

    const minAccept = Math.max(2, Math.floor(hordeWant * 0.55));
    if (cluster.length < minAccept) continue;

    for (const s of cluster) {
      opts.spawns.push(s);
      opts.spacingGrid.add(s.x, s.y);
    }
    placed += cluster.length;
  }

  return placed;
}

/** Zumbis solitários espalhados — forte viés para POIs de loot. */
function fillStrayInBand(opts: {
  band: EnemyDensityBand;
  strayTarget: number;
  spacingScale: number;
  city: City;
  collision: WorldCollision;
  rng: Rng;
  pois: City['explorationPoints'];
  cx: number;
  cy: number;
  ts: number;
  spawnClear: number | null;
  playerSpawnX?: number;
  playerSpawnY?: number;
  spawns: PlannedEnemySpawn[];
  spacingGrid: SpawnSpacingGrid;
}): number {
  if (opts.strayTarget <= 0) return 0;

  let placed = 0;
  const attempts = Math.max(opts.strayTarget * 55, 200);
  const lootBias = 0.82;

  for (let i = 0; i < attempts && placed < opts.strayTarget; i += 1) {
    let tx: number;
    let ty: number;

    if (opts.pois.length > 0 && opts.rng.chance(lootBias)) {
      const poi = opts.rng.pick(opts.pois);
      const ang = opts.rng.float(0, Math.PI * 2);
      const distTiles = 1.4 + opts.rng.float(0, 7.5);
      tx = poi.x + Math.cos(ang) * distTiles;
      ty = poi.y + Math.sin(ang) * distTiles;
    } else if (opts.rng.chance(0.35)) {
      ({ tx, ty } = pickCenterBiasedTile(
        opts.rng,
        opts.city.grid.w,
        opts.city.grid.h,
        opts.cx,
        opts.cy,
      ));
    } else {
      tx = opts.rng.float(2, opts.city.grid.w - 4);
      ty = opts.rng.float(2, opts.city.grid.h - 4);
    }

    tx = Math.max(2, Math.min(opts.city.grid.w - 3, tx));
    ty = Math.max(2, Math.min(opts.city.grid.h - 3, ty));

    const distN = centerDistanceNorm(
      tx,
      ty,
      opts.cx,
      opts.cy,
      opts.city.grid.w,
      opts.city.grid.h,
    );
    const prox = proximityFromCenter(distN);
    if (prox < opts.band.minProx || prox >= opts.band.maxProx) continue;

    const x = tx * opts.ts + opts.ts / 2;
    const y = ty * opts.ts + opts.ts / 2;
    if (opts.collision.hits({ x, y, radius: 8 })) continue;

    if (
      opts.spawnClear != null &&
      opts.playerSpawnX != null &&
      opts.playerSpawnY != null &&
      tooCloseToPoint(
        x,
        y,
        opts.playerSpawnX,
        opts.playerSpawnY,
        opts.spawnClear,
      )
    ) {
      continue;
    }

    const minSep =
      enemySpacingPx(prox, opts.ts) *
      opts.spacingScale *
      opts.band.hordeGapTiles *
      0.55;
    if (opts.spacingGrid.tooClose(x, y, minSep)) continue;

    const dmg = enemyDamageRange(prox);
    opts.spawns.push({
      x,
      y,
      proximity: prox,
      maxHp: enemyHpForProximity(prox),
      damageMin: dmg.min,
      damageMax: dmg.max,
    });
    opts.spacingGrid.add(x, y);
    placed += 1;
  }

  return placed;
}

function pickAnchorInBand(opts: {
  band: EnemyDensityBand;
  city: City;
  collision: WorldCollision;
  rng: Rng;
  pois: City['explorationPoints'];
  cx: number;
  cy: number;
  ts: number;
  spawnClear: number | null;
  playerSpawnX?: number;
  playerSpawnY?: number;
}): { x: number; y: number; prox: number } | null {
  let tx: number;
  let ty: number;

  if (opts.pois.length > 0 && opts.rng.chance(0.45)) {
    const poi = opts.rng.pick(opts.pois);
    const ang = opts.rng.float(0, Math.PI * 2);
    const distTiles = 0.5 + opts.rng.float(0, 2.5);
    tx = poi.x + Math.cos(ang) * distTiles;
    ty = poi.y + Math.sin(ang) * distTiles;
  } else {
    ({ tx, ty } = pickCenterBiasedTile(
      opts.rng,
      opts.city.grid.w,
      opts.city.grid.h,
      opts.cx,
      opts.cy,
    ));
  }

  tx = Math.max(2, Math.min(opts.city.grid.w - 3, tx));
  ty = Math.max(2, Math.min(opts.city.grid.h - 3, ty));

  const distN = centerDistanceNorm(
    tx,
    ty,
    opts.cx,
    opts.cy,
    opts.city.grid.w,
    opts.city.grid.h,
  );
  const prox = proximityFromCenter(distN);
  if (prox < opts.band.minProx || prox >= opts.band.maxProx) return null;

  const x = tx * opts.ts + opts.ts / 2;
  const y = ty * opts.ts + opts.ts / 2;
  if (opts.collision.hits({ x, y, radius: 8 })) return null;

  if (
    opts.spawnClear != null &&
    opts.playerSpawnX != null &&
    opts.playerSpawnY != null &&
    tooCloseToPoint(
      x,
      y,
      opts.playerSpawnX,
      opts.playerSpawnY,
      opts.spawnClear,
    )
  ) {
    return null;
  }

  return { x, y, prox };
}

function canPlaceHordeMember(
  x: number,
  y: number,
  prox: number,
  opts: {
    band: EnemyDensityBand;
    city: City;
    collision: WorldCollision;
    ts: number;
    spawnClear: number | null;
    playerSpawnX?: number;
    playerSpawnY?: number;
    spacingGrid: SpawnSpacingGrid;
  },
  cluster: PlannedEnemySpawn[],
  intraSep: number,
): boolean {
  const distN = centerDistanceNorm(
    x / opts.ts,
    y / opts.ts,
    opts.city.center.x,
    opts.city.center.y,
    opts.city.grid.w,
    opts.city.grid.h,
  );
  const p = proximityFromCenter(distN);
  if (p < opts.band.minProx || p >= opts.band.maxProx) return false;

  if (opts.collision.hits({ x, y, radius: 7 })) return false;

  if (
    opts.spawnClear != null &&
    opts.playerSpawnX != null &&
    opts.playerSpawnY != null &&
    tooCloseToPoint(
      x,
      y,
      opts.playerSpawnX,
      opts.playerSpawnY,
      opts.spawnClear,
    )
  ) {
    return false;
  }

  if (opts.spacingGrid.tooClose(x, y, intraSep)) return false;

  const min2 = intraSep * intraSep;
  for (const m of cluster) {
    const dx = m.x - x;
    const dy = m.y - y;
    if (dx * dx + dy * dy < min2) return false;
  }

  return true;
}

function tooCloseToPoint(
  x: number,
  y: number,
  px: number,
  py: number,
  minDist: number,
): boolean {
  const dx = x - px;
  const dy = y - py;
  return dx * dx + dy * dy < minDist * minDist;
}

function cullNearPoint(
  spawns: PlannedEnemySpawn[],
  px: number,
  py: number,
  radius: number,
): PlannedEnemySpawn[] {
  const r2 = radius * radius;
  return spawns.filter((s) => {
    const dx = s.x - px;
    const dy = s.y - py;
    return dx * dx + dy * dy >= r2;
  });
}
