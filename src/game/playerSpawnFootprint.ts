import type { AmbientProp, City } from '../world/model/types';
import type { WorldCollision } from './WorldCollision';
import { CAR_POI_TYPE_IDS } from '../assets/wreckedCars';

/** Margem extra além do raio do jogador ao validar/reservar o spawn. */
export function playerSpawnFootprintRadius(
  playerRadius: number,
  tileSize: number,
): number {
  return Math.max(playerRadius + 6, tileSize * 0.48);
}

function fireRadiusPx(tileSize: number): number {
  return tileSize * 0.55;
}

function propWorldCenter(prop: AmbientProp, tileSize: number): { x: number; y: number } {
  return {
    x: prop.x * tileSize + tileSize / 2,
    y: prop.y * tileSize + tileSize / 2,
  };
}

function propBodyRadius(prop: AmbientProp, tileSize: number): number {
  if (prop.kind === 'burning_debris') return fireRadiusPx(tileSize);
  if (prop.kind === 'wrecked_car') return tileSize * 0.95;
  if (prop.kind === 'lamp_post') return tileSize * 0.35;
  if (prop.blocks) return tileSize * 0.45;
  return tileSize * 0.38;
}

function poiBodyRadius(typeId: string, tileSize: number): number {
  if (CAR_POI_TYPE_IDS.has(typeId)) return tileSize * 0.95;
  return tileSize * 0.55;
}

function overlapsFootprint(
  px: number,
  py: number,
  footprint: number,
  ox: number,
  oy: number,
  bodyR: number,
): boolean {
  return Math.hypot(ox - px, oy - py) < footprint + bodyR;
}

/** Spawn livre de colisão, fogo, POIs e props de ambientação. */
export function isPlayerSpawnClear(
  city: City,
  collision: WorldCollision,
  px: number,
  py: number,
  playerRadius: number,
): boolean {
  if (collision.hits({ x: px, y: py, radius: playerRadius })) {
    return false;
  }

  const ts = city.tileSize;
  const footprint = playerSpawnFootprintRadius(playerRadius, ts);

  for (const prop of city.ambientProps) {
    const c = propWorldCenter(prop, ts);
    if (overlapsFootprint(px, py, footprint, c.x, c.y, propBodyRadius(prop, ts))) {
      return false;
    }
  }

  for (const poi of city.explorationPoints) {
    const ox = poi.x * ts + ts / 2;
    const oy = poi.y * ts + ts / 2;
    if (
      overlapsFootprint(px, py, footprint, ox, oy, poiBodyRadius(poi.typeId, ts))
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Remove POIs/props que ocupam o pé do spawn — o tile de nascimento fica vazio.
 * Chamar após escolher o spawn e antes de `collision.rebuild`.
 */
export function reservePlayerSpawnFootprint(
  city: City,
  px: number,
  py: number,
  playerRadius: number,
): void {
  const ts = city.tileSize;
  const footprint = playerSpawnFootprintRadius(playerRadius, ts);
  const spawnTileX = Math.floor(px / ts);
  const spawnTileY = Math.floor(py / ts);

  city.explorationPoints = city.explorationPoints.filter((poi) => {
    if (poi.x === spawnTileX && poi.y === spawnTileY) return false;
    const ox = poi.x * ts + ts / 2;
    const oy = poi.y * ts + ts / 2;
    return !overlapsFootprint(
      px,
      py,
      footprint,
      ox,
      oy,
      poiBodyRadius(poi.typeId, ts),
    );
  });

  city.ambientProps = city.ambientProps.filter((prop) => {
    if (prop.x === spawnTileX && prop.y === spawnTileY) return false;
    const c = propWorldCenter(prop, ts);
    return !overlapsFootprint(
      px,
      py,
      footprint,
      c.x,
      c.y,
      propBodyRadius(prop, ts),
    );
  });
}
