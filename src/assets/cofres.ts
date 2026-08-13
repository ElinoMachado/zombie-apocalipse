/** Spritesheet 4×2 de cofres (POI cofre). */
import { stableHash01 } from './wreckedCars';

export const COFRE_COLS = 4;
export const COFRE_ROWS = 2;
export const COFRE_FRAME_W = 390;
export const COFRE_FRAME_H = 370;
export const COFRE_FRAME_COUNT = COFRE_COLS * COFRE_ROWS;

export const COFRE_POI_TYPE_ID = 'cofre';

export function pickCofreFrame(seed: string): number {
  const idx = Math.floor(stableHash01(`${seed}:cofre`) * COFRE_FRAME_COUNT);
  return Math.min(COFRE_FRAME_COUNT - 1, idx);
}

export function cofreDisplayScale(tileSize: number): number {
  return (tileSize * 1.75) / COFRE_FRAME_H;
}

export function stableCofreRotation(_seed: string): number {
  return 0;
}
