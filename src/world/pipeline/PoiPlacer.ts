import { getExplorations } from '../catalog/structures';
import {
  centerDistanceNorm,
  pickCenterBiasedTile,
  proximityFromCenter,
  zoneThreatWeight,
} from '../../game/combat/cityThreat';
import { lootSiteDensityWeight } from '../../game/resources/lootTable';
import type { City, ExplorationPoint, ZoneType } from '../model/types';
import { Rng } from '../rng/Rng';
import {
  buildPoiPlacementContext,
  poiPlacementAffinity,
  satisfiesPoiPlacement,
} from './poiPlacementRules';
import { poiConflictsWithCars } from './poiCarClearance';
import { idx, nextId, pointInRect } from './util';

/** Chance base por zona (antes do viés de proximidade). */
const ZONE_DENSITY: Partial<Record<ZoneType, number>> = {
  center: 0.14,
  commercial: 0.1,
  mixed: 0.085,
  residential_med: 0.075,
  residential_low: 0.055,
  suburban: 0.028,
  periphery: 0.022,
  industrial: 0.045,
  rural: 0.05,
};

const BASE_URBAN_CELL_RATE = 0.0008;
const BASE_RURAL_CELL_RATE = 0.0007;
/** Multiplicadores face ao baseline histórico. */
export const URBAN_POI_DENSITY_MULT = 4;
export const RURAL_POI_DENSITY_MULT = 2;
/** Escala global sobre urbano + rural (ex.: 2 = o dobro de POIs no mapa). */
export const GLOBAL_POI_DENSITY_MULT = 2;

interface TileCandidate {
  x: number;
  y: number;
  zone: ZoneType;
}

function buildEligibleTiles(
  city: City,
  blocked: ReadonlySet<number>,
): { urban: TileCandidate[]; rural: TileCandidate[] } {
  const { w, h } = city.grid;
  const urban: TileCandidate[] = [];
  const rural: TileCandidate[] = [];
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = idx(x, y, w);
      if (blocked.has(i)) continue;
      const zone = city.zoneGrid[i]!;
      const tile = { x, y, zone };
      if (zone === 'rural') rural.push(tile);
      else urban.push(tile);
    }
  }
  return { urban, rural };
}

export function computePoiTargets(city: City, blocked: ReadonlySet<number>): {
  urban: number;
  rural: number;
} {
  const { urban, rural } = buildEligibleTiles(city, blocked);
  const scale = GLOBAL_POI_DENSITY_MULT;
  return {
    urban: Math.max(
      8,
      Math.floor(
        urban.length * BASE_URBAN_CELL_RATE * URBAN_POI_DENSITY_MULT * scale,
      ),
    ),
    rural: Math.max(
      4,
      Math.floor(
        rural.length * BASE_RURAL_CELL_RATE * RURAL_POI_DENSITY_MULT * scale,
      ),
    ),
  };
}

export function placeExplorationPoints(city: City, rng: Rng): void {
  const { w, h } = city.grid;
  const blocked = new Set<number>();

  for (const s of city.structures) {
    for (let y = s.bounds.y; y < s.bounds.y + s.bounds.h; y += 1) {
      for (let x = s.bounds.x; x < s.bounds.x + s.bounds.w; x += 1) {
        blocked.add(idx(x, y, w));
      }
    }
  }
  for (let i = 0; i < w * h; i += 1) {
    if (city.roadGrid[i]) blocked.add(i);
  }

  const explorers = getExplorations();
  const placementCtx = buildPoiPlacementContext(city);
  const points: ExplorationPoint[] = [];
  const targets = computePoiTargets(city, blocked);
  const minSep = Math.max(5, Math.floor(Math.min(w, h) / 26));
  const cx = city.center.x;
  const cy = city.center.y;
  const { urban: urbanTiles, rural: ruralTiles } = buildEligibleTiles(city, blocked);

  fillPoiRegion({
    city,
    rng,
    explorers,
    points,
    blocked,
    target: targets.urban,
    minSep,
    cx,
    cy,
    mode: 'urban',
    ruralTiles,
    urbanTiles,
    placementCtx,
  });

  fillPoiRegion({
    city,
    rng,
    explorers,
    points,
    blocked,
    target: targets.rural,
    minSep,
    cx,
    cy,
    mode: 'rural',
    ruralTiles,
    urbanTiles,
    placementCtx,
  });

  city.explorationPoints = points;
}

interface FillPoiRegionArgs {
  city: City;
  rng: Rng;
  explorers: ReturnType<typeof getExplorations>;
  points: ExplorationPoint[];
  blocked: Set<number>;
  target: number;
  minSep: number;
  cx: number;
  cy: number;
  mode: 'urban' | 'rural';
  urbanTiles: TileCandidate[];
  ruralTiles: TileCandidate[];
  placementCtx: ReturnType<typeof buildPoiPlacementContext>;
}

function fillPoiRegion(args: FillPoiRegionArgs): void {
  const {
    city,
    rng,
    explorers,
    points,
    blocked,
    target,
    minSep,
    cx,
    cy,
    mode,
    urbanTiles,
    ruralTiles,
    placementCtx,
  } = args;
  const { w } = city.grid;
  let placed = 0;
  let attempts = 0;
  const maxAttempts =
    mode === 'urban' ? 180_000 : Math.max(target * 120, 70_000);

  while (placed < target && attempts < maxAttempts) {
    attempts += 1;
    const relax = quotaRelaxation(placed, target, attempts, maxAttempts);

    const tile =
      mode === 'urban'
        ? relax.spreadUrban || rng.chance(0.42)
          ? rng.pick(urbanTiles)
          : pickCenterBiasedUrbanTile(rng, urbanTiles, cx, cy, w, city.grid.h)
        : rng.pick(ruralTiles);
    const { x, y, zone } = tile;
    if (blocked.has(idx(x, y, w))) continue;

    const effectiveMinSep = relax.reduceSep ? Math.max(4, minSep - 5) : minSep;
    const effectiveMinSep2 = effectiveMinSep * effectiveMinSep;
    let tooClose = false;
    for (const p of points) {
      const dx = p.x - x;
      const dy = p.y - y;
      if (dx * dx + dy * dy < effectiveMinSep2) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    const distN = centerDistanceNorm(x, y, cx, cy, w, city.grid.h);
    const prox = proximityFromCenter(distN);
    const dens = ZONE_DENSITY[zone] ?? 0.015;
    let accept =
      dens * 10 * lootSiteDensityWeight(prox) * zoneThreatWeight(zone);
    accept = Math.max(accept, relax.minAccept);

    const allowed = explorers.filter((d) => d.allowedZones.includes(zone));
    if (allowed.length === 0) continue;
    if (!rng.chance(accept)) continue;

    const relaxRules = {
      skipHardRules: relax.skipPlacementRules,
    };
    const suitable = allowed.filter((d) =>
      satisfiesPoiPlacement(city, x, y, zone, d.id, placementCtx, relaxRules),
    );
    if (suitable.length === 0) continue;

    const def =
      rng.pickWeightedItems(suitable, (d) => {
        const rarity = d.rarity ?? 1;
        return (
          rarity *
          poiPlacementAffinity(city, x, y, zone, d.id, placementCtx)
        );
      }) ?? rng.pick(suitable);

    if (!relax.skipPlacementRules) {
      let nearRoad = false;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const ni = idx(x + dx, y + dy, w);
          if (city.roadGrid[ni]) nearRoad = true;
        }
      }
      const inEmptyLot = city.lots.some(
        (l) => l.structureIds.length === 0 && pointInRect(x, y, l.bounds),
      );
      if (!nearRoad && !inEmptyLot && !rng.chance(0.25)) continue;
    }

    if (poiConflictsWithCars(city, x, y, def.id, points)) continue;

    points.push({
      id: nextId('poi'),
      typeId: def.id,
      x,
      y,
      loot: [],
    });
    blocked.add(idx(x, y, w));
    placed += 1;
  }
}

function pickCenterBiasedUrbanTile(
  rng: Rng,
  urbanTiles: TileCandidate[],
  cx: number,
  cy: number,
  w: number,
  h: number,
): TileCandidate {
  if (urbanTiles.length === 0) {
    const { tx, ty } = pickCenterBiasedTile(rng, w, h, cx, cy, 1);
    return {
      x: Math.floor(tx),
      y: Math.floor(ty),
      zone: 'mixed',
    };
  }
  let best = urbanTiles[0]!;
  let bestScore = -1;
  const samples = Math.min(10, urbanTiles.length);
  for (let i = 0; i < samples; i += 1) {
    const candidate = rng.pick(urbanTiles);
    const distN = centerDistanceNorm(candidate.x, candidate.y, cx, cy, w, h);
    const score = proximityFromCenter(distN) + rng.next() * 0.12;
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
}

function quotaRelaxation(
  placed: number,
  target: number,
  attempts: number,
  maxAttempts: number,
): {
  minAccept: number;
  skipPlacementRules: boolean;
  reduceSep: boolean;
  spreadUrban: boolean;
} {
  const progress = attempts / Math.max(1, maxAttempts);
  const behind = placed < target * 0.92;
  let minAccept = 0;
  if (behind && progress > 0.18) minAccept = 0.45;
  if (behind && progress > 0.32) minAccept = 0.68;
  if (behind && progress > 0.48) minAccept = 0.86;
  if (behind && progress > 0.62) minAccept = 0.95;
  return {
    minAccept,
    skipPlacementRules: behind && progress > 0.58,
    reduceSep: behind && progress > 0.2,
    spreadUrban: behind && progress > 0.1,
  };
}
