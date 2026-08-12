import { getExplorations } from '../../world/catalog/structures';
import type { City, ExplorationPoint } from '../../world/model/types';
import { poiConflictsWithCars } from '../../world/pipeline/poiCarClearance';
import { idx, inBounds } from '../../world/pipeline/util';

const GRID_COLS = 4;
const GRID_STEP_TILES = 3;
/** Distância mínima (tiles) do spawn até a grelha de showcase. */
const GRID_OFFSET_TILES = 5;

function isStructureTile(city: City, x: number, y: number): boolean {
  for (const s of city.structures) {
    const b = s.bounds;
    if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) {
      return true;
    }
  }
  return false;
}

function isTileFree(
  city: City,
  x: number,
  y: number,
  typeId: string,
  existingPois: readonly ExplorationPoint[],
  taken: Set<number>,
): boolean {
  const { w, h } = city.grid;
  if (!inBounds(x, y, w, h)) return false;
  const i = idx(x, y, w);
  if (taken.has(i)) return false;
  if (isStructureTile(city, x, y)) return false;
  if (poiConflictsWithCars(city, x, y, typeId, existingPois)) return false;
  return true;
}

function findFreeTileNear(
  city: City,
  anchorX: number,
  anchorY: number,
  typeId: string,
  existingPois: readonly ExplorationPoint[],
  taken: Set<number>,
): { x: number; y: number } | null {
  if (isTileFree(city, anchorX, anchorY, typeId, existingPois, taken)) {
    return { x: anchorX, y: anchorY };
  }
  for (let r = 1; r <= 8; r += 1) {
    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const x = anchorX + dx;
        const y = anchorY + dy;
        if (isTileFree(city, x, y, typeId, existingPois, taken)) return { x, y };
      }
    }
  }
  return null;
}

/**
 * Coloca um exemplar de cada POI de exploração numa grelha perto do spawn (modo dev).
 * @returns quantos POIs foram injectados
 */
export function injectDevPoiShowcaseNearSpawn(
  city: City,
  spawnPx: number,
  spawnPy: number,
): number {
  const ts = city.tileSize;
  const centerTx = Math.floor(spawnPx / ts);
  const centerTy = Math.floor(spawnPy / ts);
  const types = getExplorations().map((d) => d.id);

  const taken = new Set<number>();
  for (const poi of city.explorationPoints) {
    taken.add(idx(poi.x, poi.y, city.grid.w));
  }
  const added: ExplorationPoint[] = [];
  const originX = centerTx + GRID_OFFSET_TILES;
  const originY = centerTy - GRID_OFFSET_TILES;

  for (let i = 0; i < types.length; i += 1) {
    const typeId = types[i]!;
    const col = i % GRID_COLS;
    const row = Math.floor(i / GRID_COLS);
    const anchorX = originX + col * GRID_STEP_TILES;
    const anchorY = originY + row * GRID_STEP_TILES;
    const tile = findFreeTileNear(
      city,
      anchorX,
      anchorY,
      typeId,
      [...city.explorationPoints, ...added],
      taken,
    );
    if (!tile) continue;

    taken.add(idx(tile.x, tile.y, city.grid.w));
    added.push({
      id: `dev_showcase_${typeId}`,
      typeId,
      x: tile.x,
      y: tile.y,
      loot: [],
    });
  }

  city.explorationPoints = [...city.explorationPoints, ...added];
  return added.length;
}
