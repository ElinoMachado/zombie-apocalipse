import type { Rect, RoadType } from '../model/types';

let counter = 0;

export function resetIds(): void {
  counter = 0;
}

export function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}_${counter}`;
}

export function idx(x: number, y: number, w: number): number {
  return y * w + x;
}

export function inBounds(x: number, y: number, w: number, h: number): boolean {
  return x >= 0 && y >= 0 && x < w && y < h;
}

export function rectsOverlap(a: Rect, b: Rect, pad = 0): boolean {
  return !(
    a.x + a.w + pad <= b.x ||
    b.x + b.w + pad <= a.x ||
    a.y + a.h + pad <= b.y ||
    b.y + b.h + pad <= a.y
  );
}

export function containsRect(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h
  );
}

export function pointInRect(x: number, y: number, r: Rect): boolean {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

const ROAD_RANK: Record<RoadType, number> = {
  highway: 5,
  main: 4,
  avenue: 3,
  street: 2,
  residential: 1,
};

export function betterRoad(a: RoadType | null, b: RoadType | null): RoadType | null {
  if (!a) return b;
  if (!b) return a;
  return ROAD_RANK[a] >= ROAD_RANK[b] ? a : b;
}

export function paintRoadRect(
  grid: (RoadType | null)[],
  w: number,
  h: number,
  rect: Rect,
  type: RoadType,
): void {
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      if (!inBounds(x, y, w, h)) continue;
      const i = idx(x, y, w);
      grid[i] = betterRoad(grid[i]!, type);
    }
  }
}

export function modeOf<T extends string>(items: T[]): T {
  const counts = new Map<T, number>();
  for (const it of items) counts.set(it, (counts.get(it) ?? 0) + 1);
  let best = items[0]!;
  let bestN = 0;
  for (const [k, n] of counts) {
    if (n > bestN) {
      best = k;
      bestN = n;
    }
  }
  return best;
}
