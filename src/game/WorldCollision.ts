import type { AmbientProp, City, Rect, StructureInstance } from '../world/model/types';
import {
  circleHitsCarObb,
  collectWreckedCarObbs,
  rayCarObbDistance,
  type CarObbSolid,
} from '../assets/wreckedCars';
import {
  ENEMY_NAV_CELL,
  ENEMY_NAV_RADIUS,
  EnemyNavGrid,
} from './combat/EnemyNavGrid';

export interface CircleBody {
  x: number;
  y: number;
  radius: number;
}

function rectsOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function circleHitsRect(
  cx: number,
  cy: number,
  r: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): boolean {
  const nearestX = Math.max(rx, Math.min(cx, rx + rw));
  const nearestY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy < r * r;
}

function isSolidStructure(s: StructureInstance): boolean {
  if (s.typeId.includes('parking')) return false;
  return s.category === 'primary' || s.category === 'secondary';
}

/**
 * Colisão AABB/círculo contra estruturas e vegetação bloqueante.
 */
export class WorldCollision {
  private solids: Rect[] = [];
  private carObbs: CarObbSolid[] = [];
  private navGrid: EnemyNavGrid | null = null;
  private navWorldW = 0;
  private navWorldH = 0;

  rebuild(city: City): void {
    const ts = city.tileSize;
    const solids: Rect[] = [];

    for (const s of city.structures) {
      if (!isSolidStructure(s)) continue;
      solids.push({
        x: s.bounds.x * ts,
        y: s.bounds.y * ts,
        w: s.bounds.w * ts,
        h: s.bounds.h * ts,
      });
    }

    for (const p of city.ambientProps) {
      if (!p.blocks) continue;
      const size = p.kind === 'tree' ? ts * 0.55 : ts * 0.4;
      solids.push({
        x: p.x * ts + (ts - size) / 2,
        y: p.y * ts + (ts - size) / 2,
        w: size,
        h: size,
      });
    }

    this.carObbs = collectWreckedCarObbs(city);

    this.solids = solids;
    this.navGrid = null;
  }

  clear(): void {
    this.solids = [];
    this.carObbs = [];
    this.navGrid = null;
    this.navWorldW = 0;
    this.navWorldH = 0;
  }

  /** Grelha A* para IA de inimigos (lazy, invalidada no rebuild). */
  getEnemyNavGrid(worldW: number, worldH: number): EnemyNavGrid {
    if (
      !this.navGrid ||
      this.navWorldW !== worldW ||
      this.navWorldH !== worldH
    ) {
      this.navGrid = EnemyNavGrid.build(
        this,
        worldW,
        worldH,
        ENEMY_NAV_CELL,
        ENEMY_NAV_RADIUS,
      );
      this.navWorldW = worldW;
      this.navWorldH = worldH;
    }
    return this.navGrid;
  }

  hits(body: CircleBody): boolean {
    for (const s of this.solids) {
      if (circleHitsRect(body.x, body.y, body.radius, s.x, s.y, s.w, s.h)) {
        return true;
      }
    }
    for (const o of this.carObbs) {
      if (circleHitsCarObb(body.x, body.y, body.radius, o)) return true;
    }
    return false;
  }

  /**
   * Desloca o spawn para o ponto livre mais próximo se colidir com sólidos.
   */
  resolveSpawnPosition(
    x: number,
    y: number,
    radius: number,
    worldW: number,
    worldH: number,
    maxSearchPx = 128,
    stepPx = 8,
  ): { x: number; y: number } {
    const clamp = (v: number, max: number) =>
      Math.max(radius, Math.min(max - radius, v));

    const isFree = (tx: number, ty: number): { x: number; y: number } | null => {
      const cx = clamp(tx, worldW);
      const cy = clamp(ty, worldH);
      if (!this.hits({ x: cx, y: cy, radius })) return { x: cx, y: cy };
      return null;
    };

    const start = isFree(x, y);
    if (start) return start;

    for (let ring = stepPx; ring <= maxSearchPx; ring += stepPx) {
      const samples = Math.max(8, Math.ceil((2 * Math.PI * ring) / stepPx));
      for (let i = 0; i < samples; i += 1) {
        const a = (i / samples) * Math.PI * 2;
        const hit = isFree(x + Math.cos(a) * ring, y + Math.sin(a) * ring);
        if (hit) return hit;
      }
    }

    return { x: clamp(x, worldW), y: clamp(y, worldH) };
  }

  /**
   * Tenta mover com slide nos eixos; testa ordem X→Y e Y→X e fica com a melhor.
   * @returns nova posição e distância efectivamente andada.
   */
  tryMove(
    x: number,
    y: number,
    dx: number,
    dy: number,
    radius: number,
    worldW: number,
    worldH: number,
  ): { x: number; y: number; moved: number } {
    const xy = this.tryMoveAxisOrder(x, y, dx, dy, radius, worldW, worldH, 'xy');
    const yx = this.tryMoveAxisOrder(x, y, dx, dy, radius, worldW, worldH, 'yx');
    return xy.moved >= yx.moved ? xy : yx;
  }

  private tryMoveAxisOrder(
    x: number,
    y: number,
    dx: number,
    dy: number,
    radius: number,
    worldW: number,
    worldH: number,
    order: 'xy' | 'yx',
  ): { x: number; y: number; moved: number } {
    const clamp = (v: number, max: number) =>
      Math.max(radius, Math.min(max - radius, v));

    let nx = x;
    let ny = y;

    if (order === 'xy') {
      nx = clamp(x + dx, worldW);
      if (this.hits({ x: nx, y, radius })) nx = x;
      ny = clamp(y + dy, worldH);
      if (this.hits({ x: nx, y: ny, radius })) ny = y;
    } else {
      ny = clamp(y + dy, worldH);
      if (this.hits({ x, y: ny, radius })) ny = y;
      nx = clamp(x + dx, worldW);
      if (this.hits({ x: nx, y: ny, radius })) nx = x;
    }

    if (this.hits({ x: nx, y: ny, radius })) {
      return { x, y, moved: 0 };
    }

    return {
      x: nx,
      y: ny,
      moved: Math.hypot(nx - x, ny - y),
    };
  }

  /** Debug / testes. */
  get solidCount(): number {
    return this.solids.length + this.carObbs.length;
  }

  overlapsRect(r: Rect): boolean {
    for (const s of this.solids) {
      if (rectsOverlap(r.x, r.y, r.w, r.h, s.x, s.y, s.w, s.h)) return true;
    }
    return false;
  }

  /**
   * Distância ao 1º sólido ao longo de um raio (dir unitário), até `maxDist`.
   * Devolve `maxDist` se não houver obstáculo.
   */
  raycastDistance(
    ox: number,
    oy: number,
    dirX: number,
    dirY: number,
    maxDist: number,
    skipDist = 2,
  ): number {
    let closest = maxDist;
    for (const s of this.solids) {
      const t = rayAabbDistance(
        ox,
        oy,
        dirX,
        dirY,
        s.x,
        s.y,
        s.x + s.w,
        s.y + s.h,
      );
      if (t === null) continue;
      if (t > skipDist && t < closest) closest = t;
    }
    for (const o of this.carObbs) {
      const t = rayCarObbDistance(ox, oy, dirX, dirY, o);
      if (t === null) continue;
      if (t > skipDist && t < closest) closest = t;
    }
    return closest;
  }

  /**
   * Linha de visão até o alvo — bloqueada por estruturas / vegetação sólida.
   */
  hasLineOfSight(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    targetClear = 6,
  ): boolean {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return true;
    const ux = dx / dist;
    const uy = dy / dist;
    const limit = Math.max(0, dist - targetClear);
    const hit = this.raycastDistance(x0, y0, ux, uy, limit, 4);
    return hit >= limit - 0.5;
  }

  /** Testes — injecta AABBs sem gerar cidade. */
  loadSolids(solids: readonly Rect[]): void {
    this.solids = solids.map((s) => ({ ...s }));
    this.carObbs = [];
    this.navGrid = null;
  }

  /** Testes — injecta OBBs de carros. */
  loadCarObbs(obbs: readonly CarObbSolid[]): void {
    this.carObbs = obbs.map((o) => ({ ...o }));
    this.navGrid = null;
  }

  /** Hitboxes orientadas dos carros (debug). */
  get carHitboxes(): readonly CarObbSolid[] {
    return this.carObbs;
  }
}

/** Raio (origem + dir unitário) vs AABB — distância ao ponto de entrada, ou null. */
export function rayAabbDistance(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): number | null {
  let tmin = -Infinity;
  let tmax = Infinity;

  if (Math.abs(dx) < 1e-12) {
    if (ox < minX || ox > maxX) return null;
  } else {
    const t1 = (minX - ox) / dx;
    const t2 = (maxX - ox) / dx;
    tmin = Math.max(tmin, Math.min(t1, t2));
    tmax = Math.min(tmax, Math.max(t1, t2));
  }

  if (Math.abs(dy) < 1e-12) {
    if (oy < minY || oy > maxY) return null;
  } else {
    const t1 = (minY - oy) / dy;
    const t2 = (maxY - oy) / dy;
    tmin = Math.max(tmin, Math.min(t1, t2));
    tmax = Math.min(tmax, Math.max(t1, t2));
  }

  if (tmax < 0 || tmin > tmax) return null;
  const t = tmin >= 0 ? tmin : tmax;
  return t >= 0 ? t : null;
}

/** Helper para props bloqueantes (árvore/arbusto/carro). */
export function ambientBlocks(p: AmbientProp): boolean {
  return !!p.blocks || p.kind === 'wrecked_car';
}
