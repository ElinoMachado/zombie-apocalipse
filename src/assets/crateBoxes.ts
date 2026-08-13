/** Spritesheet 4×2 de caixas de cartão (POI crate). */
import { stableHash01 } from './wreckedCars';

export const CRATE_BOX_COLS = 4;
export const CRATE_BOX_ROWS = 2;
export const CRATE_BOX_FRAME_W = 379;
export const CRATE_BOX_FRAME_H = 382;
export const CRATE_BOX_FRAME_COUNT = CRATE_BOX_COLS * CRATE_BOX_ROWS;

export const CRATE_POI_TYPE_ID = 'crate';

const CRATE_FRAMES: number[] = [];
for (let i = 0; i < CRATE_BOX_FRAME_COUNT; i += 1) {
  CRATE_FRAMES.push(i);
}

export function pickCrateBoxFrame(seed: string): number {
  const idx = Math.floor(stableHash01(`${seed}:crate`) * CRATE_BOX_FRAME_COUNT);
  return CRATE_FRAMES[Math.min(CRATE_BOX_FRAME_COUNT - 1, idx)]!;
}

export function crateBoxDisplayScale(tileSize: number): number {
  return (tileSize * 1.35) / CRATE_BOX_FRAME_W;
}

export function stableCrateRotation(_seed: string): number {
  return 0;
}
