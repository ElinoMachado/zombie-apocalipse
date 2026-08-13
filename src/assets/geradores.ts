/** Spritesheet 3×3 de geradores (POI generator). */
import { stableHash01 } from './wreckedCars';

export const GERADOR_COLS = 3;
export const GERADOR_ROWS = 3;
export const GERADOR_FRAME_W = 437;
export const GERADOR_FRAME_H = 341;
export const GERADOR_FRAME_COUNT = GERADOR_COLS * GERADOR_ROWS;

export const GERADOR_POI_TYPE_ID = 'generator';

export function pickGeradorFrame(seed: string): number {
  const idx = Math.floor(stableHash01(`${seed}:gerador`) * GERADOR_FRAME_COUNT);
  return Math.min(GERADOR_FRAME_COUNT - 1, idx);
}

export function geradorDisplayScale(tileSize: number): number {
  return (tileSize * 2.05) / GERADOR_FRAME_W;
}

export function stableGeradorRotation(_seed: string): number {
  return 0;
}
