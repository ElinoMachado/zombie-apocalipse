import type { City, Density, Lot, Rect, RoadAccess, RoadType, ZoneType } from '../model/types';
import type { CityProfile } from '../profiles/types';
import { sampleDistribution, sampleInt } from '../stats/distribution';
import { Rng } from '../rng/Rng';
import { isStreetscape } from './SidewalkGenerator';
import { idx, modeOf, nextId } from './util';

function targetLotSize(
  density: Density,
  rng: Rng,
  profile: CityProfile,
): { w: number; h: number } {
  const areaDist = profile.lots.areaByDensity[density];
  let area = sampleInt(rng, areaDist);

  // When block metrics exist, softly pull lot area toward block-derived scale.
  if (
    profile.blocks.meta.confidence >= 0.3 &&
    profile.blocks.areaTiles.sampleSize > 0
  ) {
    const blockArea = sampleInt(rng, profile.blocks.areaTiles);
    const blend =
      density === 'high'
        ? 0.5
        : density === 'medium'
          ? 0.65
          : density === 'low'
            ? 0.8
            : 1.0;
    area = Math.round(area * 0.45 + blockArea * blend * 0.55);
  }

  if (area < 24) {
    area = Math.max(24, Math.round(areaDist.p50 >= 24 ? areaDist.p50 : 64));
  }
  area = Math.min(280, area);

  const aspect =
    profile.blocks.aspectRatio.p50 > 0
      ? Math.max(0.7, Math.min(2.2, sampleDistribution(rng, profile.blocks.aspectRatio)))
      : rng.float(0.9, 1.4);

  let w = Math.round(Math.sqrt(area * aspect));
  let h = Math.max(4, Math.round(area / Math.max(1, w)));
  w = Math.max(4, Math.min(20, w));
  h = Math.max(4, Math.min(18, h));
  return { w, h };
}

function computeRoadAccess(city: City, bounds: Rect): RoadAccess {
  const { w, h } = city.grid;
  let touch = 0;
  let perimeter = 0;
  let best: RoadType | null = null;
  let touchN = false;
  let touchE = false;
  let touchS = false;
  let touchW = false;
  const rank: Record<RoadType, number> = {
    highway: 5,
    main: 4,
    avenue: 3,
    street: 2,
    residential: 1,
  };

  const isAccess = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    const i = idx(x, y, w);
    const r = city.roadGrid[i];
    if (r) {
      if (!best || rank[r] > rank[best]) best = r;
      return true;
    }
    if (city.sidewalkGrid[i]) {
      for (const [dx, dy] of [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
      ] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const nr = city.roadGrid[idx(nx, ny, w)];
        if (nr && (!best || rank[nr] > rank[best])) best = nr;
      }
      return true;
    }
    return false;
  };

  for (let x = bounds.x; x < bounds.x + bounds.w; x++) {
    perimeter += 2;
    if (isAccess(x, bounds.y - 1)) {
      touch += 1;
      touchN = true;
    }
    if (isAccess(x, bounds.y + bounds.h)) {
      touch += 1;
      touchS = true;
    }
  }
  for (let y = bounds.y; y < bounds.y + bounds.h; y++) {
    perimeter += 2;
    if (isAccess(bounds.x - 1, y)) {
      touch += 1;
      touchW = true;
    }
    if (isAccess(bounds.x + bounds.w, y)) {
      touch += 1;
      touchE = true;
    }
  }

  return {
    fraction: perimeter > 0 ? touch / perimeter : 0,
    bestRoadType: best,
    touchN,
    touchE,
    touchS,
    touchW,
  };
}

function sampleZoneDensity(
  city: City,
  bounds: Rect,
): { zone: ZoneType; density: Density } {
  const { w } = city.grid;
  const zones: ZoneType[] = [];
  const dens: Density[] = [];
  for (let y = bounds.y; y < bounds.y + bounds.h; y++) {
    for (let x = bounds.x; x < bounds.x + bounds.w; x++) {
      const i = idx(x, y, w);
      if (isStreetscape(city, i)) continue;
      zones.push(city.zoneGrid[i]!);
      dens.push(city.densityGrid[i]!);
    }
  }
  if (zones.length === 0) {
    return { zone: 'rural', density: 'sparse' };
  }
  return { zone: modeOf(zones), density: modeOf(dens) };
}

function canPlaceLot(
  city: City,
  claimed: Uint8Array,
  bounds: Rect,
): boolean {
  const { w, h } = city.grid;
  if (bounds.x < 0 || bounds.y < 0) return false;
  if (bounds.x + bounds.w > w || bounds.y + bounds.h > h) return false;
  for (let y = bounds.y; y < bounds.y + bounds.h; y++) {
    for (let x = bounds.x; x < bounds.x + bounds.w; x++) {
      const i = idx(x, y, w);
      if (isStreetscape(city, i)) return false;
      if (claimed[i]) return false;
    }
  }
  return true;
}

function claimLot(claimed: Uint8Array, w: number, bounds: Rect): void {
  for (let y = bounds.y; y < bounds.y + bounds.h; y++) {
    for (let x = bounds.x; x < bounds.x + bounds.w; x++) {
      claimed[idx(x, y, w)] = 1;
    }
  }
}

/**
 * Parcelamento orientado à grelha: varre a cidade e cria lotes
 * com tamanho conforme densidade local + CityProfile.
 */
export function generateLots(city: City, rng: Rng, profile: CityProfile): void {
  const { w, h } = city.grid;
  const claimed = new Uint8Array(w * h);
  const lots: Lot[] = [];

  for (let i = 0; i < w * h; i++) {
    if (isStreetscape(city, i)) claimed[i] = 1;
  }

  let y = 1;
  while (y < h - 1) {
    let x = 1;
    let rowMaxH = 4;
    while (x < w - 1) {
      if (claimed[idx(x, y, w)]) {
        x += 1;
        continue;
      }

      const sample = sampleZoneDensity(city, { x, y, w: 1, h: 1 });
      const target = targetLotSize(sample.density, rng, profile);

      let placed: Rect | null = null;
      outer: for (let tw = target.w; tw >= 4; tw--) {
        for (let th = target.h; th >= 4; th--) {
          const bounds = { x, y, w: tw, h: th };
          if (canPlaceLot(city, claimed, bounds)) {
            placed = bounds;
            break outer;
          }
        }
      }

      if (!placed) {
        claimed[idx(x, y, w)] = 1;
        x += 1;
        continue;
      }

      claimLot(claimed, w, placed);
      const { zone, density } = sampleZoneDensity(city, placed);
      const roadAccess = computeRoadAccess(city, placed);

      lots.push({
        id: nextId('lot'),
        bounds: placed,
        zone,
        density,
        roadAccess,
        size: placed.w * placed.h,
        neighbors: [],
        structureIds: [],
      });

      rowMaxH = Math.max(rowMaxH, placed.h);
      x = placed.x + placed.w;
    }
    y += Math.max(1, Math.floor(rowMaxH * 0.85));
  }

  {
    const bucket = 24;
    const buckets = new Map<string, number[]>();
    for (let i = 0; i < lots.length; i++) {
      const b = lots[i]!.bounds;
      const bx0 = Math.floor(b.x / bucket);
      const by0 = Math.floor(b.y / bucket);
      const bx1 = Math.floor((b.x + b.w) / bucket);
      const by1 = Math.floor((b.y + b.h) / bucket);
      for (let by = by0; by <= by1; by++) {
        for (let bx = bx0; bx <= bx1; bx++) {
          const k = `${bx},${by}`;
          let list = buckets.get(k);
          if (!list) {
            list = [];
            buckets.set(k, list);
          }
          list.push(i);
        }
      }
    }

    const linked = new Set<string>();
    for (let i = 0; i < lots.length; i++) {
      const a = lots[i]!;
      const bx0 = Math.floor(a.bounds.x / bucket) - 1;
      const by0 = Math.floor(a.bounds.y / bucket) - 1;
      const bx1 = Math.floor((a.bounds.x + a.bounds.w) / bucket) + 1;
      const by1 = Math.floor((a.bounds.y + a.bounds.h) / bucket) + 1;
      const candidates = new Set<number>();
      for (let by = by0; by <= by1; by++) {
        for (let bx = bx0; bx <= bx1; bx++) {
          const list = buckets.get(`${bx},${by}`);
          if (!list) continue;
          for (const j of list) candidates.add(j);
        }
      }
      for (const j of candidates) {
        if (j <= i) continue;
        const pair = `${i}:${j}`;
        if (linked.has(pair)) continue;
        const b = lots[j]!;
        const touchX =
          a.bounds.x + a.bounds.w >= b.bounds.x - 1 &&
          b.bounds.x + b.bounds.w >= a.bounds.x - 1;
        const touchY =
          a.bounds.y + a.bounds.h >= b.bounds.y - 1 &&
          b.bounds.y + b.bounds.h >= a.bounds.y - 1;
        const adjX =
          a.bounds.x + a.bounds.w === b.bounds.x ||
          b.bounds.x + b.bounds.w === a.bounds.x;
        const adjY =
          a.bounds.y + a.bounds.h === b.bounds.y ||
          b.bounds.y + b.bounds.h === a.bounds.y;
        if ((adjX && touchY) || (adjY && touchX)) {
          linked.add(pair);
          a.neighbors.push(b.id);
          b.neighbors.push(a.id);
        }
      }
    }
  }

  city.lots = lots;
}
