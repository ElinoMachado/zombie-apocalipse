import type { City, Rect, RoadSegment, RoadType } from '../../world/model/types';
import { AssetKeys } from '../manifest';
import {
  DIR,
  frameFromRowMask,
  neighborMask4,
  type SmartTileRule,
  type TilePlacement,
} from './SmartTile';

/** Índice de tipo no atlas (cada tipo ocupa 7 linhas de markMode). */
export const ROAD_TYPE_INDEX: Record<RoadType, number> = {
  highway: 0,
  main: 1,
  avenue: 2,
  street: 3,
  residential: 4,
};

/**
 * 0 none · 1 NS-center · 2 EW-center ·
 * 3 NS-left · 4 NS-right · 5 EW-top · 6 EW-bottom
 */
export const ROAD_MARK_MODES = 7;
export const ROAD_AUTOTILE_COLS = 16;
export const ROAD_MASK = DIR;
export const ROAD_TILE_ROW = ROAD_TYPE_INDEX;

const TYPE_RANK: Record<RoadType, number> = {
  highway: 5,
  main: 4,
  avenue: 3,
  street: 2,
  residential: 1,
};

function roadAt(city: City, x: number, y: number): RoadType | null {
  const { w, h } = city.grid;
  if (x < 0 || y < 0 || x >= w || y >= h) return null;
  return city.roadGrid[y * w + x] ?? null;
}

function containsCell(rect: Rect, x: number, y: number): boolean {
  return (
    x >= rect.x &&
    y >= rect.y &&
    x < rect.x + rect.w &&
    y < rect.y + rect.h
  );
}

function segmentAxis(seg: RoadSegment): 'NS' | 'EW' {
  return seg.rect.h >= seg.rect.w ? 'NS' : 'EW';
}

/** Índice célula → segmentos (só células de estrada). Acelera paint. */
let segmentIndexCache: (RoadSegment[] | undefined)[] | null = null;
const EMPTY_SEGS: RoadSegment[] = [];

function segmentsAt(city: City, x: number, y: number): RoadSegment[] {
  if (segmentIndexCache) {
    const { w } = city.grid;
    return segmentIndexCache[y * w + x] ?? EMPTY_SEGS;
  }
  return city.roads.filter((s) => containsCell(s.rect, x, y));
}

export function buildRoadSegmentIndex(
  city: City,
): (RoadSegment[] | undefined)[] {
  const { w, h } = city.grid;
  const lists: (RoadSegment[] | undefined)[] = new Array(w * h);
  for (const seg of city.roads) {
    const { x, y, w: rw, h: rh } = seg.rect;
    for (let py = y; py < y + rh; py++) {
      if (py < 0 || py >= h) continue;
      for (let px = x; px < x + rw; px++) {
        if (px < 0 || px >= w) continue;
        const i = py * w + px;
        if (city.roadGrid[i] == null) continue;
        const bucket = lists[i];
        if (bucket) bucket.push(seg);
        else lists[i] = [seg];
      }
    }
  }
  return lists;
}

export function withRoadSegmentIndex<T>(city: City, fn: () => T): T {
  segmentIndexCache = buildRoadSegmentIndex(city);
  try {
    return fn();
  } finally {
    segmentIndexCache = null;
  }
}

function rankSeg(a: RoadSegment, b: RoadSegment): number {
  const r = TYPE_RANK[b.type] - TYPE_RANK[a.type];
  if (r !== 0) return r;
  return b.rect.w * b.rect.h - a.rect.w * a.rect.h;
}

/** Segmento dominante na célula (hierarquia > área). */
export function dominantSegment(
  city: City,
  x: number,
  y: number,
): RoadSegment | null {
  const segs = segmentsAt(city, x, y);
  if (segs.length === 0) return null;
  segs.sort(rankSeg);
  return segs[0]!;
}

/**
 * Tipo visual das marcações = segmento dominante (nunca street por cima de highway).
 * Fallback: roadGrid.
 */
export function dominantRoadType(city: City, x: number, y: number): RoadType | null {
  return dominantSegment(city, x, y)?.type ?? roadAt(city, x, y);
}

export function inferMarkAxis(
  city: City,
  x: number,
  y: number,
): 'NS' | 'EW' | null {
  const segs = segmentsAt(city, x, y);
  if (segs.length === 0) {
    const N = roadAt(city, x, y - 1) != null;
    const S = roadAt(city, x, y + 1) != null;
    const E = roadAt(city, x + 1, y) != null;
    const W = roadAt(city, x - 1, y) != null;
    if ((N || S) && (E || W)) return null;
    if (N || S) return 'NS';
    if (E || W) return 'EW';
    return 'NS';
  }

  // Cruzamento real: há pelo menos um H e um V entre os segmentos
  let hasH = false;
  let hasV = false;
  for (const s of segs) {
    if (segmentAxis(s) === 'EW') hasH = true;
    else hasV = true;
  }
  if (hasH && hasV) return null;

  const dom = dominantSegment(city, x, y)!;
  return segmentAxis(dom);
}

/**
 * Célula da linha de centro geométrico do segmento dominante no eixo dado.
 * Em empate (espessura par), fica a célula de menor índice.
 */
export function centerlineCell(
  seg: RoadSegment,
  axis: 'NS' | 'EW',
): number {
  if (axis === 'NS') {
    const roadMid = seg.rect.x + seg.rect.w / 2;
    let best = seg.rect.x;
    let bestDist = Infinity;
    for (let cx = seg.rect.x; cx < seg.rect.x + seg.rect.w; cx++) {
      const d = Math.abs(cx + 0.5 - roadMid);
      if (d < bestDist - 1e-9) {
        bestDist = d;
        best = cx;
      }
    }
    return best;
  }
  const roadMid = seg.rect.y + seg.rect.h / 2;
  let best = seg.rect.y;
  let bestDist = Infinity;
  for (let cy = seg.rect.y; cy < seg.rect.y + seg.rect.h; cy++) {
    const d = Math.abs(cy + 0.5 - roadMid);
    if (d < bestDist - 1e-9) {
      bestDist = d;
      best = cy;
    }
  }
  return best;
}

export function markModeForCell(city: City, x: number, y: number): number {
  const axis = inferMarkAxis(city, x, y);
  if (!axis) return 0;

  const dom = dominantSegment(city, x, y);
  if (!dom) {
    return axis === 'NS' ? 1 : 2;
  }

  // Só o segmento dominante no mesmo eixo define a faixa
  if (segmentAxis(dom) !== axis) return 0;

  if (axis === 'NS') {
    const cx = centerlineCell(dom, 'NS');
    if (x !== cx) return 0;
    const roadMid = dom.rect.x + dom.rect.w / 2;
    const cellMid = x + 0.5;
    const delta = roadMid - cellMid;
    if (Math.abs(delta) < 0.05) return 1; // centro do tile
    if (delta < 0) return 3; // centro da via à esquerda → traço à esquerda
    return 4; // traço à direita
  }

  const cy = centerlineCell(dom, 'EW');
  if (y !== cy) return 0;
  const roadMid = dom.rect.y + dom.rect.h / 2;
  const cellMid = y + 0.5;
  const delta = roadMid - cellMid;
  if (Math.abs(delta) < 0.05) return 2;
  if (delta < 0) return 5; // cima
  return 6; // baixo
}

export function roadConnects(city: City, x: number, y: number): boolean {
  return roadAt(city, x, y) != null;
}

export function roadNeighborMask(city: City, x: number, y: number): number {
  return neighborMask4(x, y, (nx, ny) => roadConnects(city, nx, ny));
}

export function roadFrameIndex(
  type: RoadType,
  mask: number,
  markMode = 0,
): number {
  const typeRow = ROAD_TYPE_INDEX[type] ?? 3;
  const row = typeRow * ROAD_MARK_MODES + markMode;
  return frameFromRowMask(row, mask, ROAD_AUTOTILE_COLS);
}

export const roadSmartRule: SmartTileRule<City> = {
  id: 'roads',
  textureKey: AssetKeys.roads,
  resolve(city, x, y): TilePlacement | null {
    // Early-out: sem asfalto não há tile (evita segmentsAt em células vazias)
    if (roadAt(city, x, y) == null) return null;

    const type = dominantRoadType(city, x, y);
    if (!type) return null;

    const mask = roadNeighborMask(city, x, y);
    const markMode = markModeForCell(city, x, y);
    return {
      textureKey: AssetKeys.roads,
      frame: roadFrameIndex(type, mask, markMode),
    };
  },
};

export function chooseRoadTile(
  city: City,
  x: number,
  y: number,
): TilePlacement | null {
  return roadSmartRule.resolve(city, x, y);
}

export function roadTileFrame(city: City, x: number, y: number): number | null {
  return chooseRoadTile(city, x, y)?.frame ?? null;
}

/** @deprecated */
export function isMarkCenterline(
  city: City,
  x: number,
  y: number,
  axis: 'NS' | 'EW',
): boolean {
  const dom = dominantSegment(city, x, y);
  if (!dom) return true;
  if (segmentAxis(dom) !== axis) return false;
  return axis === 'NS'
    ? x === centerlineCell(dom, 'NS')
    : y === centerlineCell(dom, 'EW');
}
