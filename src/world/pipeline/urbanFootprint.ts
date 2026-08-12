import type { City } from '../model/types';
import { idx } from './util';

/**
 * Escala das quadras vs. espaçamento antigo de ruas.
 * Não comprimimos o passo para “encher” o mapa.
 */
export const BLOCK_SCALE = 6;

/** Calçada: manter alinhado com SidewalkGenerator.SIDEWALK_WIDTH (evita ciclo). */
const EDGE_PAD = 2;

/**
 * Recuo extra da rede viária urbana em relação à orla rural.
 * Evita quadras “pela metade” na borda: só ficam quarteirões inteiros
 * dentro do núcleo; a franja vira rural limpo (só highway).
 */
export function urbanBlockInsetTiles(): number {
  // ~ meia quadra mínima — remove franja incompleta sem esvaziar a cidade
  return Math.max(10, 7 * BLOCK_SCALE);
}

/**
 * Pegada urbana. `insetTiles` > 0 = núcleo de quadras completas
 * (mais interior que a orla rural suave).
 */
export function isUrbanCell(
  city: City,
  x: number,
  y: number,
  ruralEdgeBandFraction = 0.12,
  insetTiles = 0,
): boolean {
  const { w, h } = city.grid;
  const maxDist = Math.hypot(w / 2, h / 2) || 1;
  const distNorm =
    Math.hypot(x - city.center.x, y - city.center.y) / maxDist;
  const ruralBand =
    Math.max(8, Math.floor(Math.min(w, h) * ruralEdgeBandFraction)) +
    insetTiles;
  const edgeDist = Math.min(x, y, w - 1 - x, h - 1 - y);
  if (edgeDist < ruralBand) return false;

  const distLimit = 0.7 - insetTiles / Math.max(maxDist, 1);
  if (distNorm > Math.max(0.45, distLimit)) return false;
  return true;
}

/**
 * Após trim + calçadas: alinha zonas à rede viária urbana.
 * - Interior do bbox das vias urbanas → sem rural a meio da quadra
 * - Fora desse bbox → rural (exceto highway)
 */
export function finalizeUrbanEdge(city: City): void {
  const { w, h } = city.grid;
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = idx(x, y, w);
      const road = city.roadGrid[i];
      if (!road || road === 'highway') continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX) return;

  const pad = EDGE_PAD;
  const x0 = Math.max(0, minX - pad);
  const y0 = Math.max(0, minY - pad);
  const x1 = Math.min(w - 1, maxX + pad);
  const y1 = Math.min(h - 1, maxY + pad);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = idx(x, y, w);
      const road = city.roadGrid[i];
      const inside = x >= x0 && x <= x1 && y >= y0 && y <= y1;

      if (inside) {
        if (city.zoneGrid[i] === 'rural' && road !== 'highway') {
          city.zoneGrid[i] = 'periphery';
          city.densityGrid[i] = 'low';
        }
        if (city.sidewalkGrid[i] && city.zoneGrid[i] === 'rural') {
          city.zoneGrid[i] = 'periphery';
          city.densityGrid[i] = 'low';
        }
      } else {
        if (road && road !== 'highway') {
          city.roadGrid[i] = null;
        }
        if (city.sidewalkGrid[i]) {
          city.sidewalkGrid[i] = false;
        }
        city.zoneGrid[i] = 'rural';
        city.densityGrid[i] = 'sparse';
      }
    }
  }
}
