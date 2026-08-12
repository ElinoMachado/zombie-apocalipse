import { AssetKeys } from './manifest';
import type { RoadType, ZoneType } from '../world/model/types';

/** Frame indices curated from Kenney packed sheets (16×16). */

export const UrbanFrames = {
  grass: [0, 1, 2, 3, 4, 5, 6, 7],
  grassAlt: [27, 28, 29, 30],
  sidewalk: [81, 83, 84, 85, 111, 112],
  asphalt: [254],
  asphaltAlt: [408, 409, 410, 411],
  brick: [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26],
  brickAlt: [43, 44, 45, 46],
  roof: [244, 245, 246],
} as const;

export const TownFrames = {
  /** Chão de grama (lawn) — Tiny Town topo-esquerdo. */
  grass: [0, 1, 2],
  path: [63, 78, 88, 89],
  wall: [48, 49, 50, 51],
  roof: [107, 130],
} as const;

export const FarmFrames = {
  dirt: [0, 1, 3],
  /** Tiny Farm não tem lawn limpo — usar TownFrames.grass no terreno. */
  grass: [] as number[],
  crop: [93, 94, 95],
  wood: [81, 82, 84],
} as const;

export interface TileRef {
  sheet: string;
  frame: number;
  /** Escala visual tipica do prop. */
  scale?: number;
}

function pick(frames: readonly number[], salt: number): number {
  return frames[Math.abs(salt) % frames.length]!;
}

/**
 * Solo: só grama (textura do utilizador) nas zonas verdes.
 * Outras zonas → null (tint simples no renderer, sem Kenney).
 */
export function terrainTile(
  zone: ZoneType,
  _x: number,
  _y: number,
): TileRef | null {
  switch (zone) {
    case 'rural':
    case 'periphery':
    case 'suburban':
    case 'residential_low':
    case 'residential_med':
    case 'mixed':
      return { sheet: AssetKeys.grass, frame: 0 };
    default:
      // center / commercial / industrial — sem textura Kenney por agora
      return null;
  }
}

export function roadTile(type: RoadType, _x: number, _y: number): TileRef {
  // Prefer dedicated road tileset + RoadAutotile; this remains a Kenney fallback.
  if (type === 'highway' || type === 'main') {
    return { sheet: AssetKeys.urbanSheet, frame: UrbanFrames.asphalt[0]! };
  }
  if (type === 'avenue') {
    return {
      sheet: AssetKeys.urbanSheet,
      frame: UrbanFrames.asphaltAlt[0]!,
    };
  }
  if (type === 'street') {
    return {
      sheet: AssetKeys.urbanSheet,
      frame: UrbanFrames.sidewalk[0]!,
    };
  }
  return { sheet: AssetKeys.townSheet, frame: TownFrames.path[0]! };
}

export function structureTile(
  category: 'primary' | 'secondary' | 'exploration',
  typeId: string,
  x: number,
  y: number,
): TileRef {
  const salt = x * 13 + y * 37 + typeId.length * 9;
  if (
    typeId.includes('farm') ||
    typeId === 'barn' ||
    typeId === 'silo' ||
    typeId === 'stable'
  ) {
    return { sheet: AssetKeys.farmSheet, frame: pick(FarmFrames.wood, salt) };
  }
  if (category === 'secondary') {
    return {
      sheet: AssetKeys.urbanSheet,
      frame: pick(UrbanFrames.brickAlt, salt),
    };
  }
  if (typeId === 'parking' || typeId === 'parking_lot') {
    return { sheet: AssetKeys.urbanSheet, frame: UrbanFrames.asphalt[0]! };
  }
  return { sheet: AssetKeys.urbanSheet, frame: pick(UrbanFrames.brick, salt) };
}
