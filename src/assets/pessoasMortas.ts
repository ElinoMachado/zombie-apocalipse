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
/** Cadáver de zumbi derrotado — lootável, sem atrair outros zumbis. */
export const ZOMBIE_CORPSE_POI_TYPE_ID = 'zombie_corpse';

export function isZombieCorpseId(corpseId: string): boolean {
  return corpseId.startsWith('zombie-corpse-');
}

/** Tint verde para distinguir cadáver infectado no mapa. */
export const ZOMBIE_CORPSE_TINT = 0x6dff8a;

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
