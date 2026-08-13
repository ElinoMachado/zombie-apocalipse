import type { City, Rect, ZoneType } from '../model/types';
import { SIDEWALK_WIDTH } from './SidewalkGenerator';
import { idx } from './util';

const INDUSTRIAL_ANCHOR_TYPES = new Set([
  'factory',
  'warehouse',
  'industrial_yard',
  'workshop',
  'depot',
  'storage',
  'workshop_annex',
]);

const COMMERCIAL_ANCHOR_TYPES = new Set([
  'market',
  'restaurant',
  'convenience',
  'hotel',
  'gas_station',
  'pharmacy',
  'parking',
  'parking_lot',
]);

const SCHOOL_NEAR_RADIUS = 22;
const INDUSTRIAL_NEAR_RADIUS = 20;
const COMMERCIAL_NEAR_RADIUS = 16;
const ROAD_NEAR_RADIUS = 2;

export interface StructureAnchor {
  typeId: string;
  cx: number;
  cy: number;
}

export interface PoiPlacementContext {
  anchors: StructureAnchor[];
  industrialAnchors: StructureAnchor[];
  commercialAnchors: StructureAnchor[];
  schoolAnchors: StructureAnchor[];
  /** Distância em tiles até a via mais próxima (-1 = inacessível). */
  roadDistance: Int16Array;
}

/** BFS a partir do asfalto — mesma lógica base do gerador de calçadas. */
export function computeRoadDistanceGrid(city: City): Int16Array {
  const { w, h } = city.grid;
  const dist = new Int16Array(w * h).fill(-1);
  const queue: number[] = [];

  for (let i = 0; i < w * h; i += 1) {
    if (city.roadGrid[i] == null) continue;
    if (city.zoneGrid[i] === 'rural' && city.roadGrid[i] === 'highway') continue;
    dist[i] = 0;
    queue.push(i);
  }

  let head = 0;
  while (head < queue.length) {
    const i = queue[head++]!;
    const d = dist[i]!;
    const x = i % w;
    const y = (i / w) | 0;
    for (const [nx, ny] of [
      [x, y - 1],
      [x + 1, y],
      [x, y + 1],
      [x - 1, y],
    ]) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = idx(nx, ny, w);
      if (dist[ni]! >= 0) continue;
      if (city.zoneGrid[ni] === 'rural' && city.roadGrid[ni] == null) continue;
      dist[ni] = d + 1;
      queue.push(ni);
    }
  }

  return dist;
}

export function buildPoiPlacementContext(city: City): PoiPlacementContext {
  const anchors: StructureAnchor[] = [];
  for (const s of city.structures) {
    anchors.push({
      typeId: s.typeId,
      cx: s.bounds.x + s.bounds.w / 2,
      cy: s.bounds.y + s.bounds.h / 2,
    });
  }
  return {
    anchors,
    industrialAnchors: anchors.filter((a) => INDUSTRIAL_ANCHOR_TYPES.has(a.typeId)),
    commercialAnchors: anchors.filter((a) => COMMERCIAL_ANCHOR_TYPES.has(a.typeId)),
    schoolAnchors: anchors.filter((a) => a.typeId === 'school'),
    roadDistance: computeRoadDistanceGrid(city),
  };
}

function tileDistToPoint(x: number, y: number, cx: number, cy: number): number {
  const dx = x + 0.5 - cx;
  const dy = y + 0.5 - cy;
  return Math.hypot(dx, dy);
}

function nearestAnchorDist(
  x: number,
  y: number,
  anchors: readonly StructureAnchor[],
): number {
  if (anchors.length === 0) return Infinity;
  let best = Infinity;
  for (const a of anchors) {
    const d = tileDistToPoint(x, y, a.cx, a.cy);
    if (d < best) best = d;
  }
  return best;
}

function isOnRoad(city: City, x: number, y: number): boolean {
  const { w, h } = city.grid;
  if (x < 0 || y < 0 || x >= w || y >= h) return false;
  return city.roadGrid[idx(x, y, w)] != null;
}

export function isOnSidewalk(city: City, x: number, y: number): boolean {
  const { w, h } = city.grid;
  if (x < 0 || y < 0 || x >= w || y >= h) return false;
  return city.sidewalkGrid[idx(x, y, w)] === true;
}

/**
 * Calçada na fila interior (afastada do asfalto) e com face para lote/grama.
 * Com SIDEWALK_WIDTH=1, exige vizinho interior; com faixa mais larga, usa a última fila.
 */
export function isSidewalkInnerEdgeTile(
  city: City,
  x: number,
  y: number,
  roadDistance: Int16Array,
): boolean {
  if (!isOnSidewalk(city, x, y)) return false;

  const { w, h } = city.grid;
  const myD = roadDistance[idx(x, y, w)]!;
  if (myD < 1 || myD < SIDEWALK_WIDTH) return false;

  let touchesInterior = false;

  for (const [dx, dy] of [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ]) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
    const ni = idx(nx, ny, w);

    if (city.roadGrid[ni] != null) continue;

    if (isOnSidewalk(city, nx, ny)) {
      if (roadDistance[ni]! > myD) return false;
      continue;
    }

    touchesInterior = true;
  }

  return touchesInterior;
}

/** Deslocamento em tiles do centro do tile em direção ao lote (borda interior). */
export function trashBinInnerEdgeOffsetTiles(
  city: City,
  x: number,
  y: number,
): { ox: number; oy: number } {
  const { w, h } = city.grid;
  let ix = 0;
  let iy = 0;
  let count = 0;

  for (const [dx, dy] of [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ]) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
    const ni = idx(nx, ny, w);
    if (city.roadGrid[ni] != null || city.sidewalkGrid[ni]) continue;
    ix += dx;
    iy += dy;
    count += 1;
  }

  if (count === 0) return { ox: 0, oy: 0 };

  const len = Math.hypot(ix, iy) || 1;
  const push = 0.4;
  return { ox: (ix / len) * push, oy: (iy / len) * push };
}

function isNearRoad(city: City, x: number, y: number, radius = ROAD_NEAR_RADIUS): boolean {
  const { w, h } = city.grid;
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (city.roadGrid[idx(nx, ny, w)] != null) return true;
    }
  }
  return false;
}

function isInEmptyLot(city: City, x: number, y: number): boolean {
  return city.lots.some(
    (l) => l.structureIds.length === 0 && pointInRect(x, y, l.bounds),
  );
}

function pointInRect(x: number, y: number, r: Rect): boolean {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

function isIndustrialContext(
  _city: City,
  x: number,
  y: number,
  zone: ZoneType,
  ctx: PoiPlacementContext,
  radius = INDUSTRIAL_NEAR_RADIUS,
): boolean {
  if (zone === 'industrial') return true;
  return nearestAnchorDist(x, y, ctx.industrialAnchors) <= radius;
}

function isCommercialContext(
  _city: City,
  x: number,
  y: number,
  zone: ZoneType,
  ctx: PoiPlacementContext,
  radius = COMMERCIAL_NEAR_RADIUS,
): boolean {
  if (zone === 'commercial' || zone === 'center' || zone === 'mixed') return true;
  return nearestAnchorDist(x, y, ctx.commercialAnchors) <= radius;
}

export interface PoiPlacementRelax {
  skipHardRules: boolean;
}

/** Tipos que exigem calçada — regra mantida mesmo com relax parcial. */
export function poiRequiresSidewalk(typeId: string): boolean {
  return typeId === 'trash_bin';
}

/** POI válido neste tile (regras duras). */
export function satisfiesPoiPlacement(
  city: City,
  x: number,
  y: number,
  zone: ZoneType,
  typeId: string,
  ctx: PoiPlacementContext,
  relax: PoiPlacementRelax,
): boolean {
  const onRoad = isOnRoad(city, x, y);
  const onSidewalk = isOnSidewalk(city, x, y);

  if (onRoad && typeId !== 'abandoned_car' && typeId !== 'car_trunk') {
    return false;
  }

  if (poiRequiresSidewalk(typeId)) {
    if (!onSidewalk) return false;
    return isSidewalkInnerEdgeTile(city, x, y, ctx.roadDistance);
  }

  if (onSidewalk) return false;

  if (relax.skipHardRules) {
    return !onRoad;
  }

  switch (typeId) {
    case 'backpack':
      return nearestAnchorDist(x, y, ctx.schoolAnchors) <= SCHOOL_NEAR_RADIUS;
    case 'generator':
      return isIndustrialContext(city, x, y, zone, ctx);
    case 'container':
      return (
        isIndustrialContext(city, x, y, zone, ctx) ||
        (zone === 'periphery' && isNearRoad(city, x, y))
      );
    case 'machine':
      return isIndustrialContext(city, x, y, zone, ctx, 24);
    case 'crate':
      return (
        isInEmptyLot(city, x, y) ||
        isIndustrialContext(city, x, y, zone, ctx, 14) ||
        (zone === 'rural' && isNearRoad(city, x, y, 3))
      );
    case 'malas':
      return isCommercialContext(city, x, y, zone, ctx) && isNearRoad(city, x, y);
    case 'cofre':
      return (
        nearestAnchorDist(x, y, ctx.industrialAnchors) <= 18 ||
        nearestAnchorDist(x, y, ctx.commercialAnchors) <= 14 ||
        city.structures.some(
          (s) =>
            (s.typeId === 'parking' || s.typeId === 'garage') &&
            tileDistToPoint(
              x,
              y,
              s.bounds.x + s.bounds.w / 2,
              s.bounds.y + s.bounds.h / 2,
            ) <= 16,
        )
      );
    case 'corpse':
      return (
        isInEmptyLot(city, x, y) ||
        zone === 'periphery' ||
        zone === 'rural' ||
        zone === 'suburban' ||
        (zone === 'residential_low' && isNearRoad(city, x, y, 3))
      );
    case 'abandoned_car':
    case 'car_trunk':
      return isNearRoad(city, x, y, 3);
    default:
      return true;
  }
}

/** Peso extra quando o contexto espacial combina com o tipo. */
export function poiPlacementAffinity(
  city: City,
  x: number,
  y: number,
  zone: ZoneType,
  typeId: string,
  ctx: PoiPlacementContext,
): number {
  let w = 1;

  switch (typeId) {
    case 'trash_bin':
      if (
        isSidewalkInnerEdgeTile(city, x, y, ctx.roadDistance)
      ) {
        w *= 4;
      }
      break;
    case 'backpack': {
      const d = nearestAnchorDist(x, y, ctx.schoolAnchors);
      if (d <= SCHOOL_NEAR_RADIUS) w *= 1 + Math.max(0, 2.5 - d / 10);
      break;
    }
    case 'generator':
    case 'container':
    case 'machine':
      if (isIndustrialContext(city, x, y, zone, ctx)) w *= 2.2;
      break;
    case 'malas':
      if (isCommercialContext(city, x, y, zone, ctx)) w *= 1.8;
      break;
    case 'crate':
      if (isInEmptyLot(city, x, y)) w *= 2;
      break;
    case 'corpse':
      if (isInEmptyLot(city, x, y) || zone === 'periphery') w *= 1.6;
      break;
    case 'abandoned_car':
    case 'car_trunk':
      if (isNearRoad(city, x, y, 1)) w *= 2;
      break;
    default:
      break;
  }

  return w;
}
