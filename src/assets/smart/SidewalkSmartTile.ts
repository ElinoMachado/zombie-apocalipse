import type { City } from '../../world/model/types';
import { AssetKeys } from '../manifest';
import {
  DIR,
  frameFromRowMask,
  neighborMask4,
  type SmartTileRule,
  type TilePlacement,
} from './SmartTile';

export const SIDEWALK_AUTOTILE_COLS = 16;
export const SIDEWALK_MASK = DIR;

function sidewalkOrRoad(city: City, x: number, y: number): boolean {
  const { w, h } = city.grid;
  if (x < 0 || y < 0 || x >= w || y >= h) return false;
  const i = y * w + x;
  return city.sidewalkGrid[i] === true || city.roadGrid[i] != null;
}

export function sidewalkNeighborMask(city: City, x: number, y: number): number {
  return neighborMask4(x, y, (nx, ny) => sidewalkOrRoad(city, nx, ny));
}

export function sidewalkFrameIndex(mask: number): number {
  return frameFromRowMask(0, mask, SIDEWALK_AUTOTILE_COLS);
}

export const sidewalkSmartRule: SmartTileRule<City> = {
  id: 'sidewalks',
  textureKey: AssetKeys.sidewalks,
  resolve(city, x, y): TilePlacement | null {
    const { w, h } = city.grid;
    if (x < 0 || y < 0 || x >= w || y >= h) return null;
    if (!city.sidewalkGrid[y * w + x]) return null;
    // Estrada por cima — não pintar calçada nesta célula
    if (city.roadGrid[y * w + x] != null) return null;

    return {
      textureKey: AssetKeys.sidewalks,
      frame: sidewalkFrameIndex(sidewalkNeighborMask(city, x, y)),
    };
  },
};

export function chooseSidewalkTile(
  city: City,
  x: number,
  y: number,
): TilePlacement | null {
  return sidewalkSmartRule.resolve(city, x, y);
}
