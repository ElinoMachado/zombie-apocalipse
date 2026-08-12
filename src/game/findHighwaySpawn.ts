import type { City, Point } from '../world/model/types';
import { isUrbanCell } from '../world/pipeline/urbanFootprint';
import { idx } from '../world/pipeline/util';

export interface HighwaySpawnOptions {
  ruralEdgeBandFraction?: number;
  /**
   * Margem mínima em tiles até à borda do mapa.
   * Deve ser ≥ metade da viewport (em tiles) para a câmara centrar
   * o player sem mostrar o fim do mundo.
   */
  marginTilesX?: number;
  marginTilesY?: number;
}

/**
 * Highway fora da cidade, com folga até à borda do mapa
 * para a câmara conseguir manter o player no centro.
 */
export function findHighwaySpawnOutsideCity(
  city: City,
  options: HighwaySpawnOptions | number = {},
): Point | null {
  const opts: HighwaySpawnOptions =
    typeof options === 'number'
      ? { ruralEdgeBandFraction: options }
      : options;

  const ruralEdgeBandFraction = opts.ruralEdgeBandFraction ?? 0.12;
  const { w, h } = city.grid;
  const marginX = Math.max(1, opts.marginTilesX ?? 8);
  const marginY = Math.max(1, opts.marginTilesY ?? 8);

  type Cand = { x: number; y: number; edge: number; urbanDist: number };
  const safe: Cand[] = [];
  const unsafe: Cand[] = [];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = idx(x, y, w);
      if (city.roadGrid[i] !== 'highway') continue;
      if (isUrbanCell(city, x, y, ruralEdgeBandFraction, 0)) continue;

      const edge = Math.min(x, y, w - 1 - x, h - 1 - y);
      const urbanDist = Math.hypot(x - city.center.x, y - city.center.y);
      const cand: Cand = { x, y, edge, urbanDist };
      const okX = x >= marginX && x < w - marginX;
      const okY = y >= marginY && y < h - marginY;
      if (okX && okY) safe.push(cand);
      else unsafe.push(cand);
    }
  }

  const pool = safe.length > 0 ? safe : unsafe;
  if (pool.length === 0) {
    for (let y = marginY; y < h - marginY; y++) {
      for (let x = marginX; x < w - marginX; x++) {
        if (city.roadGrid[idx(x, y, w)] === 'highway') {
          return { x, y };
        }
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (city.roadGrid[idx(x, y, w)] === 'highway') {
          return { x, y };
        }
      }
    }
    return null;
  }

  // Fora da cidade, mas o mais “interior” possível (maior distância à borda)
  // entre os que já respeitam a margem da câmara — assim não cola no canto.
  pool.sort((a, b) => {
    if (b.edge !== a.edge) return b.edge - a.edge;
    // Empate: um pouco mais longe do centro urbano (ainda rural)
    return b.urbanDist - a.urbanDist;
  });

  // Entre os melhores (maior edge), escolhe aleatório
  const bestEdge = pool[0]!.edge;
  const top = pool.filter((c) => c.edge >= bestEdge - 1);
  const pick = top[Math.floor(Math.random() * top.length)]!;
  return { x: pick.x, y: pick.y };
}

/** Meia viewport em tiles para um zoom e tamanho de ecrã dados. */
export function cameraSafeMarginTiles(
  viewWidthPx: number,
  viewHeightPx: number,
  zoom: number,
  tileSize: number,
  padTiles = 2,
): { marginTilesX: number; marginTilesY: number } {
  const halfViewX = viewWidthPx / (2 * zoom);
  const halfViewY = viewHeightPx / (2 * zoom);
  return {
    marginTilesX: Math.ceil(halfViewX / tileSize) + padTiles,
    marginTilesY: Math.ceil(halfViewY / tileSize) + padTiles,
  };
}
