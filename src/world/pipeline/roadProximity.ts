import type { City, RoadType } from '../model/types';
import { idx } from './util';

/**
 * Máscara booleana: célula a ≤ `radius` (Chebyshev) de alguma via dos tipos dados.
 * Uma BFS multi-fonte — O(N) em vez de O(N × r²) por célula.
 */
export function buildNearRoadMask(
  city: City,
  types: readonly RoadType[],
  radius: number,
): Uint8Array {
  const { w, h } = city.grid;
  const want = new Set(types);
  const out = new Uint8Array(w * h);
  const dist = new Int16Array(w * h).fill(-1);
  const queue: number[] = [];

  for (let i = 0; i < w * h; i++) {
    const r = city.roadGrid[i];
    if (!r || !want.has(r)) continue;
    dist[i] = 0;
    out[i] = 1;
    queue.push(i);
  }

  let head = 0;
  while (head < queue.length) {
    const i = queue[head++]!;
    const d = dist[i]!;
    if (d >= radius) continue;
    const x = i % w;
    const y = (i / w) | 0;
    for (const [dx, dy] of [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = idx(nx, ny, w);
      if (dist[ni]! >= 0) continue;
      dist[ni] = d + 1;
      out[ni] = 1;
      queue.push(ni);
    }
  }

  return out;
}

/** Distância Manhattan à via major mais próxima; 255 = longe. */
export function buildMajorRoadDistance(city: City): Uint8Array {
  return buildDistanceFromPredicate(
    city,
    (i) => {
      const r = city.roadGrid[i];
      return r === 'highway' || r === 'main' || r === 'avenue';
    },
  );
}

/** Distância à via ou calçada mais próxima. */
export function buildStreetscapeDistance(city: City): Uint8Array {
  return buildDistanceFromPredicate(
    city,
    (i) => city.roadGrid[i] != null || city.sidewalkGrid[i] === true,
  );
}

function buildDistanceFromPredicate(
  city: City,
  seed: (i: number) => boolean,
): Uint8Array {
  const { w, h } = city.grid;
  const dist = new Uint8Array(w * h).fill(255);
  const queue: number[] = [];

  for (let i = 0; i < w * h; i++) {
    if (!seed(i)) continue;
    dist[i] = 0;
    queue.push(i);
  }

  let head = 0;
  while (head < queue.length) {
    const i = queue[head++]!;
    const d = dist[i]!;
    if (d >= 254) continue;
    const x = i % w;
    const y = (i / w) | 0;
    for (const [dx, dy] of [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = idx(nx, ny, w);
      if (dist[ni]! <= d + 1) continue;
      dist[ni] = d + 1;
      queue.push(ni);
    }
  }

  return dist;
}
