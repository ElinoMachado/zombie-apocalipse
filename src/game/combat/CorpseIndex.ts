import type { City } from '../../world/model/types';
import { CORPSE_POI_TYPE_ID } from '../../assets/pessoasMortas';
import { stableHash01 } from '../../assets/wreckedCars';
import type { WorldCollision } from '../WorldCollision';
import { inCone } from './visionCone';

export interface CorpseSite {
  id: string;
  x: number;
  y: number;
}

/** Máximo de zumbis a comer o mesmo cadáver em simultâneo. */
export const MAX_CORPSE_EATERS = 5;
/** Raio (tiles) para parar e comer ao chegar. */
export const CORPSE_EAT_RADIUS_TILES = 1.2;
/** Tempo máximo a comer um cadáver (s). */
export const CORPSE_EAT_MAX_SEC = 30;
export const CORPSE_EAT_MIN_SEC = 12;
/** Após comer, zumbi ignora cadáveres durante este intervalo (s). */
export const CORPSE_EAT_COOLDOWN_SEC = 60;

export function corpseEatDurationSec(enemyId: string, corpseId: string): number {
  const t = stableHash01(`${enemyId}:eat:${corpseId}`);
  const raw = CORPSE_EAT_MIN_SEC + t * (CORPSE_EAT_MAX_SEC - CORPSE_EAT_MIN_SEC);
  return Math.min(CORPSE_EAT_MAX_SEC, raw);
}

/** Índice espacial de POIs corpse (px mundo). */
export class CorpseIndex {
  private readonly cellSize: number;
  private readonly cells = new Map<number, CorpseSite[]>();

  private constructor(
    private readonly corpses: readonly CorpseSite[],
    cellSize: number,
  ) {
    this.cellSize = cellSize;
    for (const c of corpses) {
      this.insert(c);
    }
  }

  static fromCity(city: City): CorpseIndex {
    const ts = city.tileSize;
    const corpses: CorpseSite[] = [];
    for (const poi of city.explorationPoints) {
      if (poi.typeId !== CORPSE_POI_TYPE_ID) continue;
      corpses.push({
        id: poi.id,
        x: poi.x * ts + ts / 2,
        y: poi.y * ts + ts / 2,
      });
    }
    return new CorpseIndex(corpses, Math.max(64, ts * 2));
  }

  get count(): number {
    return this.corpses.length;
  }

  findNearest(
    x: number,
    y: number,
    radius: number,
  ): { corpse: CorpseSite; dist: number } | null {
    if (this.corpses.length === 0) return null;
    const cs = this.cellSize;
    const r2 = radius * radius;
    let best: CorpseSite | null = null;
    let bestD = Infinity;

    const minCx = Math.floor((x - radius) / cs);
    const maxCx = Math.floor((x + radius) / cs);
    const minCy = Math.floor((y - radius) / cs);
    const maxCy = Math.floor((y + radius) / cs);

    for (let cy = minCy; cy <= maxCy; cy += 1) {
      for (let cx = minCx; cx <= maxCx; cx += 1) {
        const bucket = this.cells.get(this.key(cx, cy));
        if (!bucket) continue;
        for (const c of bucket) {
          const dx = c.x - x;
          const dy = c.y - y;
          const d2 = dx * dx + dy * dy;
          if (d2 > r2) continue;
          const d = Math.sqrt(d2);
          if (d < bestD) {
            bestD = d;
            best = c;
          }
        }
      }
    }

    return best ? { corpse: best, dist: bestD } : null;
  }

  /** Cadáver mais próximo dentro do cone de visão (com LOS). */
  findInVisionCone(
    ox: number,
    oy: number,
    facing: number,
    range: number,
    halfAngle: number,
    collision: WorldCollision | null,
  ): CorpseSite | null {
    if (this.corpses.length === 0) return null;
    const cs = this.cellSize;
    let best: CorpseSite | null = null;
    let bestD = Infinity;

    const minCx = Math.floor((ox - range) / cs);
    const maxCx = Math.floor((ox + range) / cs);
    const minCy = Math.floor((oy - range) / cs);
    const maxCy = Math.floor((oy + range) / cs);

    for (let cy = minCy; cy <= maxCy; cy += 1) {
      for (let cx = minCx; cx <= maxCx; cx += 1) {
        const bucket = this.cells.get(this.key(cx, cy));
        if (!bucket) continue;
        for (const c of bucket) {
          if (!inCone(ox, oy, facing, c.x, c.y, range, halfAngle)) continue;
          if (collision && !collision.hasLineOfSight(ox, oy, c.x, c.y)) continue;
          const d = Math.hypot(c.x - ox, c.y - oy);
          if (d < bestD) {
            bestD = d;
            best = c;
          }
        }
      }
    }

    return best;
  }

  private insert(c: CorpseSite): void {
    const cx = Math.floor(c.x / this.cellSize);
    const cy = Math.floor(c.y / this.cellSize);
    const k = this.key(cx, cy);
    let bucket = this.cells.get(k);
    if (!bucket) {
      bucket = [];
      this.cells.set(k, bucket);
    }
    bucket.push(c);
  }

  private key(cx: number, cy: number): number {
    return cx * 65599 + cy;
  }
}

export function corpseEatRadiusPx(tileSize: number): number {
  return tileSize * CORPSE_EAT_RADIUS_TILES;
}
