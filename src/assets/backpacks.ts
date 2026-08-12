/** Spritesheet 4×2 de mochilas (POI backpack). */
import { stableHash01 } from './wreckedCars';

export const BACKPACK_COLS = 4;
export const BACKPACK_ROWS = 2;
export const BACKPACK_FRAME_W = 235;
export const BACKPACK_FRAME_H = 268;
export const BACKPACK_FRAME_COUNT = BACKPACK_COLS * BACKPACK_ROWS;

export const BACKPACK_POI_TYPE_ID = 'backpack';

const BACKPACK_FRAMES: number[] = [];
for (let i = 0; i < BACKPACK_FRAME_COUNT; i += 1) {
  BACKPACK_FRAMES.push(i);
}

export function pickBackpackFrame(seed: string): number {
  const idx = Math.floor(stableHash01(`${seed}:backpack`) * BACKPACK_FRAME_COUNT);
  return BACKPACK_FRAMES[Math.min(BACKPACK_FRAME_COUNT - 1, idx)]!;
}

export function backpackDisplayScale(tileSize: number): number {
  return (tileSize * 1.45) / BACKPACK_FRAME_W;
}

export function stableBackpackRotation(seed: string): number {
  return stableHash01(`${seed}:backpack-rot`) * Math.PI * 2;
}
