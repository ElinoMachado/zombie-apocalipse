/** Spritesheet 4×2 de lixeiras (POI trash_bin). */
import { stableHash01 } from './wreckedCars';

export const LIXEIRA_COLS = 4;
export const LIXEIRA_ROWS = 2;
export const LIXEIRA_FRAME_W = 361;
export const LIXEIRA_FRAME_H = 461;
export const LIXEIRA_FRAME_COUNT = LIXEIRA_COLS * LIXEIRA_ROWS;

export const LIXEIRA_POI_TYPE_ID = 'trash_bin';

export function pickLixeiraFrame(seed: string): number {
  const idx = Math.floor(stableHash01(`${seed}:lixeira`) * LIXEIRA_FRAME_COUNT);
  return Math.min(LIXEIRA_FRAME_COUNT - 1, idx);
}

export function lixeiraDisplayScale(tileSize: number): number {
  return (tileSize * 1.65) / LIXEIRA_FRAME_H;
}

export function stableLixeiraRotation(_seed: string): number {
  return 0;
}
