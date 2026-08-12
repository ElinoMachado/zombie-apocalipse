import type { City, Point } from '../world/model/types';
import type { WorldCollision } from './WorldCollision';
import {
  findHighwaySpawnOutsideCity,
  type HighwaySpawnOptions,
} from './findHighwaySpawn';
import { isUrbanCell } from '../world/pipeline/urbanFootprint';
import { idx } from '../world/pipeline/util';

export interface SafeSpawnResult {
  x: number;
  y: number;
}

/**
 * Posição livre de colisão para o jogador, preferindo spawn em highway rural.
 */
export function findSafePlayerSpawn(
  city: City,
  collision: WorldCollision,
  worldW: number,
  worldH: number,
  playerRadius: number,
  options: HighwaySpawnOptions = {},
): SafeSpawnResult {
  const ts = city.tileSize;
  const candidates: Point[] = [];

  const preferred = findHighwaySpawnOutsideCity(city, options);
  if (preferred) candidates.push(preferred);

  const ruralEdge = options.ruralEdgeBandFraction ?? 0.12;
  const { w, h } = city.grid;
  const highwayTiles: Point[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (city.roadGrid[idx(x, y, w)] !== 'highway') continue;
      if (isUrbanCell(city, x, y, ruralEdge, 0)) continue;
      if (preferred && preferred.x === x && preferred.y === y) continue;
      highwayTiles.push({ x, y });
    }
  }
  // Amostra até 48 alternativas para não varrer o mapa inteiro.
  for (let i = highwayTiles.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [highwayTiles[i], highwayTiles[j]] = [highwayTiles[j]!, highwayTiles[i]!];
  }
  candidates.push(...highwayTiles.slice(0, 48));

  for (const c of candidates) {
    const px = c.x * ts + ts / 2;
    const py = c.y * ts + ts / 2;
    const safe = collision.resolveSpawnPosition(
      px,
      py,
      playerRadius,
      worldW,
      worldH,
    );
    if (!collision.hits({ x: safe.x, y: safe.y, radius: playerRadius })) {
      return safe;
    }
  }

  const cx = worldW / 2;
  const cy = worldH / 2;
  const fallback = collision.resolveSpawnPosition(
    cx,
    cy,
    playerRadius,
    worldW,
    worldH,
    256,
  );
  return fallback;
}
