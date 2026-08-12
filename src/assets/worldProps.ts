import { AssetKeys, type AssetKey } from './manifest';
import { stableHash01 } from './wreckedCars';

/** Dimensões nativas (px) e tamanho alvo no mundo (em tiles). */
const PROP_SPECS: Record<
  AssetKey,
  { frameW: number; frameH: number; targetTiles: number }
> = {
  [AssetKeys.lixeira]: { frameW: 682, frameH: 1024, targetTiles: 1.65 },
  [AssetKeys.gerador]: { frameW: 682, frameH: 1024, targetTiles: 2.05 },
  [AssetKeys.cadaver1]: { frameW: 1024, frameH: 682, targetTiles: 2.55 },
  [AssetKeys.cadaver2]: { frameW: 1024, frameH: 682, targetTiles: 2.55 },
};

const POI_TYPE_TO_KEY: Record<string, AssetKey> = {
  trash_bin: AssetKeys.lixeira,
  generator: AssetKeys.gerador,
};

export function pickCorpseVariant(poiId: string): AssetKey {
  return stableHash01(`${poiId}:corpse`) < 0.5
    ? AssetKeys.cadaver1
    : AssetKeys.cadaver2;
}

export function getPoiSpriteKey(typeId: string, poiId: string): AssetKey | null {
  const mapped = POI_TYPE_TO_KEY[typeId];
  if (mapped) return mapped;
  if (typeId === 'corpse') return pickCorpseVariant(poiId);
  return null;
}

export function worldPropDisplayScale(tileSize: number, key: AssetKey): number {
  const spec = PROP_SPECS[key];
  const longSide = Math.max(spec.frameW, spec.frameH);
  return (tileSize * spec.targetTiles) / longSide;
}

export function stablePropRotation(seed: string, typeId: string): number {
  if (typeId === 'corpse') {
    return stableHash01(`${seed}:prop-rot`) * Math.PI * 2;
  }
  return 0;
}
