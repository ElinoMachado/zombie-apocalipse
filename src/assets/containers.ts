/** Spritesheet 2×4 de contentores (POI container). */
import { stableHash01 } from './wreckedCars';

export const CONTAINER_COLS = 2;
export const CONTAINER_ROWS = 4;
export const CONTAINER_FRAME_W = 434;
export const CONTAINER_FRAME_H = 256;
export const CONTAINER_FRAME_COUNT = CONTAINER_COLS * CONTAINER_ROWS;

export const CONTAINER_POI_TYPE_ID = 'container';

const CONTAINER_FRAMES: number[] = [];
for (let i = 0; i < CONTAINER_FRAME_COUNT; i += 1) {
  CONTAINER_FRAMES.push(i);
}

export function pickContainerFrame(seed: string): number {
  const idx = Math.floor(stableHash01(`${seed}:container`) * CONTAINER_FRAME_COUNT);
  return CONTAINER_FRAMES[Math.min(CONTAINER_FRAME_COUNT - 1, idx)]!;
}

export function containerDisplayScale(tileSize: number): number {
  return (tileSize * 2.55) / CONTAINER_FRAME_W;
}

export function stableContainerRotation(seed: string): number {
  return stableHash01(`${seed}:container-rot`) * Math.PI * 2;
}
