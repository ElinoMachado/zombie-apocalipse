/** Spritesheet 4×2 de máquinas (POI machine). */
import { stableHash01 } from './wreckedCars';

export const MACHINE_COLS = 4;
export const MACHINE_ROWS = 2;
export const MACHINE_FRAME_W = 284;
export const MACHINE_FRAME_H = 421;
export const MACHINE_FRAME_COUNT = MACHINE_COLS * MACHINE_ROWS;

export const MACHINE_POI_TYPE_ID = 'machine';

export function pickMachineFrame(seed: string): number {
  const idx = Math.floor(stableHash01(`${seed}:machine`) * MACHINE_FRAME_COUNT);
  return Math.min(MACHINE_FRAME_COUNT - 1, idx);
}

export function machineDisplayScale(tileSize: number): number {
  return (tileSize * 2.1) / MACHINE_FRAME_H;
}

export function stableMachineRotation(_seed: string): number {
  return 0;
}
