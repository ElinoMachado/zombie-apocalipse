import { CAR_POI_TYPE_IDS } from '../../assets/wreckedCars';
import type { City, ExplorationPoint } from '../model/types';

/** Distância mínima (tiles) entre POIs e carros (POI ou ambient). */
export const POI_CAR_CLEARANCE_TILES = 5;

export function isCarPoiType(typeId: string): boolean {
  return CAR_POI_TYPE_IDS.has(typeId);
}

function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function tooCloseToCarPois(
  x: number,
  y: number,
  pois: readonly Pick<ExplorationPoint, 'typeId' | 'x' | 'y'>[],
  minTiles = POI_CAR_CLEARANCE_TILES,
): boolean {
  const min2 = minTiles * minTiles;
  for (const p of pois) {
    if (!isCarPoiType(p.typeId)) continue;
    if (dist2(x, y, p.x, p.y) < min2) return true;
  }
  return false;
}

export function tooCloseToWreckedCars(
  x: number,
  y: number,
  city: City,
  minTiles = POI_CAR_CLEARANCE_TILES,
): boolean {
  const min2 = minTiles * minTiles;
  for (const p of city.ambientProps) {
    if (p.kind !== 'wrecked_car') continue;
    if (dist2(x, y, p.x, p.y) < min2) return true;
  }
  return false;
}

export function tooCloseToNonCarPois(
  x: number,
  y: number,
  pois: readonly Pick<ExplorationPoint, 'typeId' | 'x' | 'y'>[],
  minTiles = POI_CAR_CLEARANCE_TILES,
): boolean {
  const min2 = minTiles * minTiles;
  for (const p of pois) {
    if (isCarPoiType(p.typeId)) continue;
    if (dist2(x, y, p.x, p.y) < min2) return true;
  }
  return false;
}

/** Evita sobreposição visual entre POIs e carros abandonados / tombados. */
export function poiConflictsWithCars(
  city: City,
  x: number,
  y: number,
  typeId: string,
  existingPois: readonly Pick<ExplorationPoint, 'typeId' | 'x' | 'y'>[],
): boolean {
  if (isCarPoiType(typeId)) {
    return tooCloseToNonCarPois(x, y, existingPois);
  }
  if (tooCloseToCarPois(x, y, existingPois)) return true;
  if (tooCloseToWreckedCars(x, y, city)) return true;
  return false;
}
