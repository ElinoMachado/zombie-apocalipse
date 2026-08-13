import { getRuntimePoiRotationOverride } from '../game/dev/poiRotationOverrides';

export interface PoiSpriteRotationOverride {
  /** Rotação extra do arte (rad), somada à rotação base do POI. */
  artRotation?: number;
}

/** Overrides permanentes — gerados pela ferramenta Sprites (rotação POI). */
export const POI_SPRITE_ROTATION_OVERRIDES: Record<
  string,
  Record<number, PoiSpriteRotationOverride>
> = {};

function codeOverride(
  typeId: string,
  frame: number,
): PoiSpriteRotationOverride | undefined {
  return POI_SPRITE_ROTATION_OVERRIDES[typeId]?.[frame];
}

/** Rotação final do sprite de POI (base procedural + overrides). */
export function resolvePoiSpriteRotation(
  typeId: string,
  frame: number,
  baseRotation: number,
): number {
  const code = codeOverride(typeId, frame)?.artRotation ?? 0;
  const runtime = getRuntimePoiRotationOverride(typeId, frame)?.artRotation ?? 0;
  return baseRotation + code + runtime;
}
