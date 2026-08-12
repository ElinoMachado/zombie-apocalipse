import type { City } from '../model/types';
import { idx } from './util';

/**
 * Largura da calçada em tiles (profundidade a partir do asfalto).
 * 1 tile = metade do anel anterior (2).
 */
export const SIDEWALK_WIDTH = 1;

/**
 * Anel de calçada em células não-estrada adjacentes às vias urbanas.
 * Não entra em zona rural (só highways passam no campo, sem calçada).
 * Corre depois de zonas + trim das vias.
 */
export function generateSidewalks(city: City): void {
  const { w, h } = city.grid;
  const depth = Math.max(1, SIDEWALK_WIDTH);
  const grid = new Array<boolean>(w * h).fill(false);
  const dist = new Int16Array(w * h).fill(-1);
  const queue: number[] = [];

  for (let i = 0; i < w * h; i++) {
    if (city.roadGrid[i] == null) continue;
    // Highway no rural: sem calçada
    if (city.zoneGrid[i] === 'rural' && city.roadGrid[i] === 'highway') continue;
    dist[i] = 0;
    queue.push(i);
  }

  let head = 0;
  while (head < queue.length) {
    const i = queue[head++]!;
    const d = dist[i]!;
    if (d >= depth) continue;

    const x = i % w;
    const y = (i / w) | 0;
    const neighbors = [
      [x, y - 1],
      [x + 1, y],
      [x, y + 1],
      [x - 1, y],
    ];

    for (const [nx, ny] of neighbors) {
      if (nx! < 0 || ny! < 0 || nx! >= w || ny! >= h) continue;
      const ni = idx(nx!, ny!, w);
      if (dist[ni]! >= 0) continue;
      if (city.roadGrid[ni] != null) continue;
      if (city.zoneGrid[ni] === 'rural') continue;

      const nd = d + 1;
      dist[ni] = nd;
      if (nd <= depth) {
        grid[ni] = true;
        queue.push(ni);
      }
    }
  }

  city.sidewalkGrid = grid;
}

export function isSidewalk(city: City, x: number, y: number): boolean {
  const { w, h } = city.grid;
  if (x < 0 || y < 0 || x >= w || y >= h) return false;
  return city.sidewalkGrid[idx(x, y, w)] === true;
}

/** Célula bloqueada para lotes / POIs (asfalto ou calçada). */
export function isStreetscape(city: City, i: number): boolean {
  return city.roadGrid[i] != null || city.sidewalkGrid[i] === true;
}
