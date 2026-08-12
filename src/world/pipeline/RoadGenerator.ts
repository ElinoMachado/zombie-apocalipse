import type { City, CitySizeClass, Rect, RoadSegment, RoadType } from '../model/types';
import type { CityProfile } from '../profiles/types';
import { Rng } from '../rng/Rng';
import {
  BLOCK_SCALE,
  isUrbanCell,
  urbanBlockInsetTiles,
} from './urbanFootprint';
import { idx, inBounds, nextId, paintRoadRect } from './util';

/**
 * Espessura das vias em tiles: ímpar e múltiplo de 3
 * (centro geométrico cai no meio de um tile → faixas centradas).
 */
export const ROAD_THICKNESS: Record<RoadType, number> = {
  highway: 3,
  main: 3,
  avenue: 3,
  street: 3,
  residential: 3,
};

export { BLOCK_SCALE } from './urbanFootprint';

/** Highways mais largas em cidades médias/grandes (ainda ímpar ×3). */
export function roadThickness(
  type: RoadType,
  sizeClass: CitySizeClass,
): number {
  if (type === 'highway' && sizeClass !== 'small') return 9;
  return ROAD_THICKNESS[type];
}

function segment(type: RoadType, rect: Rect): RoadSegment {
  return { id: nextId('road'), type, rect };
}

function paintH(
  city: City,
  y: number,
  x0: number,
  x1: number,
  thickness: number,
  type: RoadType,
  segments: RoadSegment[],
): void {
  const { w, h } = city.grid;
  const t = Math.max(1, thickness);
  const rect: Rect = {
    x: Math.min(x0, x1),
    y: Math.max(0, y - Math.floor(t / 2)),
    w: Math.abs(x1 - x0) + 1,
    h: t,
  };
  paintRoadRect(city.roadGrid, w, h, rect, type);
  segments.push(segment(type, rect));
}

function paintV(
  city: City,
  x: number,
  y0: number,
  y1: number,
  thickness: number,
  type: RoadType,
  segments: RoadSegment[],
): void {
  const { w, h } = city.grid;
  const t = Math.max(1, thickness);
  const rect: Rect = {
    x: Math.max(0, x - Math.floor(t / 2)),
    y: Math.min(y0, y1),
    w: t,
    h: Math.abs(y1 - y0) + 1,
  };
  paintRoadRect(city.roadGrid, w, h, rect, type);
  segments.push(segment(type, rect));
}

function clampInt(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function segmentTouchesRoad(city: City, seg: RoadSegment): boolean {
  const { w, h } = city.grid;
  const { x, y, w: rw, h: rh } = seg.rect;
  for (let py = y; py < y + rh; py++) {
    for (let px = x; px < x + rw; px++) {
      if (px < 0 || py < 0 || px >= w || py >= h) continue;
      if (city.roadGrid[idx(px, py, w)] === seg.type) return true;
    }
  }
  return false;
}

/**
 * Remove vias que não são highway fora do núcleo de quadras completas.
 * Highways atravessam o campo; o resto pára antes da orla (sem meia-quadra).
 */
export function trimNonHighwayRoadsToUrban(
  city: City,
  ruralEdgeBandFraction = 0.12,
): void {
  const { w, h } = city.grid;
  const inset = urbanBlockInsetTiles();
  for (let i = 0; i < w * h; i++) {
    const road = city.roadGrid[i];
    if (!road || road === 'highway') continue;
    const x = i % w;
    const y = (i / w) | 0;
    if (!isUrbanCell(city, x, y, ruralEdgeBandFraction, inset)) {
      city.roadGrid[i] = null;
    }
  }

  city.roads = city.roads.filter((seg) => {
    if (seg.type === 'highway') return true;
    return segmentTouchesRoad(city, seg);
  });
}

/**
 * Hierarquia: highway → main → avenue → street → residential.
 * Irregularidade e espaçamento calibrados pelo CityProfile.
 */
export function generateRoads(city: City, rng: Rng, profile: CityProfile): void {
  const { w, h } = city.grid;
  const cx = city.center.x;
  const cy = city.center.y;
  const segments: RoadSegment[] = [];
  const rn = profile.roadNetwork;
  const hw = rn.hierarchyWeights;
  const sc = city.sizeClass;

  const deadEndP = Math.min(0.35, Math.max(0.04, rn.deadEndRatio.p50));
  const regularity = Math.min(1, Math.max(0, rn.regularity));
  const jitterAmp = clampInt(2 + (1 - regularity) * 10, 2, 12);

  const segLo = clampInt(rn.segmentLengthTiles.p25, 5, 14);
  const segHi = clampInt(rn.segmentLengthTiles.p75, segLo + 1, 22);

  const avenueW = hw.avenue ?? 5;
  const streetW = hw.street ?? 8;
  const resW = hw.residential ?? 6;
  const hwyW = hw.highway ?? 3;

  const tHwy = roadThickness('highway', sc);
  const tMain = roadThickness('main', sc);
  const tAve = roadThickness('avenue', sc);
  const tStreet = roadThickness('street', sc);
  const tRes = roadThickness('residential', sc);

  // Highways — únicas vias que atravessam o mapa inteiro (incl. rural)
  const hwyY = Math.max(4, Math.min(h - 5, cy + rng.int(-h / 5, h / 5)));
  paintH(city, hwyY, 0, w - 1, tHwy, 'highway', segments);

  const hwyChance = Math.min(0.95, 0.45 + hwyW * 0.08);
  if (rng.chance(hwyChance)) {
    const hwyX = Math.max(4, Math.min(w - 5, cx + rng.int(-w / 4, w / 4)));
    paintV(city, hwyX, 0, h - 1, tHwy, 'highway', segments);
  }

  // Main — eixos urbanos (serão cortados no rural depois das zonas)
  paintH(city, cy, 0, w - 1, tMain, 'main', segments);
  paintV(city, cx, 0, h - 1, tMain, 'main', segments);

  // Avenues — menos cruzes → quarteirões maiores (não encolher para caber)
  const avenueXs: number[] = [];
  const avenueYs: number[] = [];
  const baseAvX = city.sizeClass === 'large' ? 2 : 1;
  const baseAvY = city.sizeClass === 'large' ? 1 : 1;
  const avScale = Math.min(1.6, Math.max(0.55, avenueW / 5));
  const avCountX = Math.max(1, Math.round(baseAvX * avScale));
  const avCountY = Math.max(1, Math.round(baseAvY * avScale));

  for (let i = 0; i < avCountX; i++) {
    const ideal = Math.floor(((i + 1) * w) / (avCountX + 1));
    const x = Math.max(6, Math.min(w - 7, ideal + rng.int(-jitterAmp, jitterAmp)));
    avenueXs.push(x);
    paintV(city, x, rng.int(0, 4), h - 1 - rng.int(0, 4), tAve, 'avenue', segments);
  }
  for (let i = 0; i < avCountY; i++) {
    const ideal = Math.floor(((i + 1) * h) / (avCountY + 1));
    const y = Math.max(6, Math.min(h - 7, ideal + rng.int(-jitterAmp, jitterAmp)));
    avenueYs.push(y);
    paintH(city, y, rng.int(0, 4), w - 1 - rng.int(0, 4), tAve, 'avenue', segments);
  }

  const vLines = [0, ...avenueXs, cx, w - 1].sort((a, b) => a - b);
  const hLines = [0, ...avenueYs, cy, hwyY, h - 1].sort((a, b) => a - b);

  const uniq = (arr: number[]) =>
    arr.filter((v, i) => i === 0 || v !== arr[i - 1]);

  const vCuts = uniq(vLines);
  const hCuts = uniq(hLines);

  // Streets — espaçamento × BLOCK_SCALE (quadras grandes); mapa cresce a par
  const streetDensity = Math.min(1.4, Math.max(0.55, streetW / 8));
  const stepLo = Math.max(
    10 * BLOCK_SCALE,
    Math.round((segLo / streetDensity) * BLOCK_SCALE),
  );
  const stepHi = Math.max(
    stepLo + 2,
    Math.round((segHi / streetDensity) * BLOCK_SCALE),
  );
  const minBlockW = 14 * BLOCK_SCALE;
  const minBlockH = 12 * BLOCK_SCALE;

  for (let i = 0; i < vCuts.length - 1; i++) {
    const x0 = vCuts[i]!;
    const x1 = vCuts[i + 1]!;
    if (x1 - x0 < minBlockW) continue;
    let cursor = x0 + rng.int(Math.max(8, stepLo - 4), stepLo + 4);
    while (cursor < x1 - Math.floor(minBlockW / 3)) {
      const deadEnd = rng.chance(deadEndP);
      const yStart = deadEnd ? rng.int(2, Math.floor(h / 3)) : 0;
      const yEnd = deadEnd ? rng.int(Math.floor((2 * h) / 3), h - 2) : h - 1;
      paintV(city, cursor, yStart, yEnd, tStreet, 'street', segments);
      cursor += rng.int(stepLo, stepHi);
    }
  }

  for (let i = 0; i < hCuts.length - 1; i++) {
    const y0 = hCuts[i]!;
    const y1 = hCuts[i + 1]!;
    if (y1 - y0 < minBlockH) continue;
    let cursor = y0 + rng.int(Math.max(8, stepLo - 6), stepLo + 2);
    while (cursor < y1 - Math.floor(minBlockH / 3)) {
      const deadEnd = rng.chance(deadEndP);
      const xStart = deadEnd ? rng.int(2, Math.floor(w / 3)) : 0;
      const xEnd = deadEnd ? rng.int(Math.floor((2 * w) / 3), w - 2) : w - 1;
      paintH(city, cursor, xStart, xEnd, tStreet, 'street', segments);
      cursor += rng.int(Math.max(10, stepLo - 2), Math.max(stepLo, stepHi - 2));
    }
  }

  // Residential — ruas locais curtas (também cortadas no rural)
  const baseRes =
    city.sizeClass === 'small' ? 6 : city.sizeClass === 'medium' ? 12 : 18;
  const resPasses = Math.max(
    3,
    Math.round(baseRes * Math.min(1.5, Math.max(0.45, resW / 6))),
  );
  const resLenLo = clampInt(rn.segmentLengthTiles.p10 * BLOCK_SCALE, 8, 48);
  const resLenHi = clampInt(
    rn.segmentLengthTiles.p50 * BLOCK_SCALE,
    resLenLo + 2,
    72,
  );

  for (let n = 0; n < resPasses; n++) {
    const horizontal = rng.chance(0.5);
    if (horizontal) {
      const y = rng.int(2, h - 3);
      const x0 = rng.int(1, w - 10);
      const len = rng.int(resLenLo, resLenHi);
      paintH(city, y, x0, Math.min(w - 2, x0 + len), tRes, 'residential', segments);
    } else {
      const x = rng.int(2, w - 3);
      const y0 = rng.int(1, h - 10);
      const len = rng.int(resLenLo, Math.max(resLenLo + 1, resLenHi - 2));
      paintV(city, x, y0, Math.min(h - 2, y0 + len), tRes, 'residential', segments);
    }
  }

  void inBounds;
  city.roads = segments;
}
