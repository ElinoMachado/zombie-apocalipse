/** Spritesheet 4×2 de cadáveres (POI corpse). */
import { stableGroundLyingRotation } from './poiCardinalRotation';
import { stableHash01 } from './wreckedCars';

export const PESSOAS_MORTAS_COLS = 4;
export const PESSOAS_MORTAS_ROWS = 2;
export const PESSOAS_MORTAS_FRAME_W = 384;
export const PESSOAS_MORTAS_FRAME_H = 469;
export const PESSOAS_MORTAS_FRAME_COUNT =
  PESSOAS_MORTAS_COLS * PESSOAS_MORTAS_ROWS;

export const CORPSE_POI_TYPE_ID = 'corpse';

export function pickCorpseFrame(seed: string): number {
  const idx = Math.floor(
    stableHash01(`${seed}:corpse`) * PESSOAS_MORTAS_FRAME_COUNT,
  );
  return Math.min(PESSOAS_MORTAS_FRAME_COUNT - 1, idx);
}

export function corpseDisplayScale(tileSize: number): number {
  return (tileSize * 2.55) / PESSOAS_MORTAS_FRAME_H;
}

export function stableCorpseRotation(seed: string): number {
  return stableGroundLyingRotation(seed, 'corpse-rot');
}
