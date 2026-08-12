/** Spritesheet 4×2 de malas (POI malas, ex-caçamba). */
import { stableHash01 } from './wreckedCars';

export const MALAS_COLS = 4;
export const MALAS_ROWS = 2;
export const MALAS_FRAME_W = 256;
export const MALAS_FRAME_H = 324;
export const MALAS_FRAME_COUNT = MALAS_COLS * MALAS_ROWS;

export const MALAS_POI_TYPE_ID = 'malas';

const MALAS_FRAMES: number[] = [];
for (let i = 0; i < MALAS_FRAME_COUNT; i += 1) {
  MALAS_FRAMES.push(i);
}

export function pickMalasFrame(seed: string): number {
  const idx = Math.floor(stableHash01(`${seed}:malas`) * MALAS_FRAME_COUNT);
  return MALAS_FRAMES[Math.min(MALAS_FRAME_COUNT - 1, idx)]!;
}

export function malasDisplayScale(tileSize: number): number {
  return (tileSize * 1.5) / MALAS_FRAME_W;
}

export function stableMalasRotation(seed: string): number {
  return stableHash01(`${seed}:malas-rot`) * Math.PI * 2;
}
