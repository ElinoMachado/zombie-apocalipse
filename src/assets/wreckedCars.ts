/** Spritesheet 14×3 de carros abandonados (top-down). */
import { getRuntimeProfileOverride } from '../game/dev/wreckedCarProfileOverrides';

export const WRECKED_CAR_COLS = 14;
export const WRECKED_CAR_ROWS = 3;
export const WRECKED_CAR_FRAME_W = 73;
export const WRECKED_CAR_FRAME_H = 122;

/** Todas as linhas da folha são variantes top-down. */
export const WRECKED_CAR_ROW_START = 0;
export const WRECKED_CAR_ROW_END = 2;

export const WRECKED_CAR_FRAME_COUNT =
  WRECKED_CAR_COLS * WRECKED_CAR_ROWS;

/**
 * Fração do sprite (sem rotação) usada na hitbox.
 * Ajustado para ignorar margem transparente da folha.
 */
export const WRECKED_CAR_COLLISION_WIDTH_FRAC = 0.74;
export const WRECKED_CAR_COLLISION_HEIGHT_FRAC = 0.78;
/** Escala global da hitbox (+50% sobre ×0.67 → ×1.005). */
export const WRECKED_CAR_COLLISION_SIZE_MULT = 1.005;

const WRECKED_FRAMES: number[] = [];
for (let row = WRECKED_CAR_ROW_START; row <= WRECKED_CAR_ROW_END; row += 1) {
  for (let col = 0; col < WRECKED_CAR_COLS; col += 1) {
    WRECKED_FRAMES.push(row * WRECKED_CAR_COLS + col);
  }
}

/** Índice pseudo-aleatório estável a partir de uma seed string/numérica. */
export function stableHash01(seed: string | number): number {
  const s = String(seed);
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

export function pickWreckedCarFrame(seed: string | number): number {
  const t = stableHash01(seed);
  const idx = Math.floor(t * WRECKED_FRAMES.length);
  return WRECKED_FRAMES[idx] ?? WRECKED_FRAMES[0]!;
}

/** Índices de frames usados no jogo (todas as linhas da folha). */
export function listWreckedCarFrames(): readonly number[] {
  return WRECKED_FRAMES;
}

export function wreckedCarDisplayScale(tileSize: number): number {
  return (tileSize * 2.65) / WRECKED_CAR_FRAME_W;
}

export function stableCarRotation(seed: string | number): number {
  return stableHash01(`${seed}:rot`) * Math.PI * 2;
}

export function wreckedCarFrameRow(frame: number): number {
  return Math.floor(frame / WRECKED_CAR_COLS);
}

/** Ajuste por linha da folha — alinha eixo longo da hitbox ao desenho do sprite. */
export interface WreckedCarFrameCollisionProfile {
  /** Comprimento do carro ao longo do eixo X do sprite (tombados). */
  swapAxes: boolean;
  /** Rotação extra do arte no sprite (rad), somada à do mundo. */
  artRotation: number;
  /** Deslocamento do centro em frações do sprite (antes da rotação). */
  localOffsetX: number;
  localOffsetY: number;
}

/** Overrides permanentes (gerados pela ferramenta Sprites). */
export const WRECKED_CAR_FRAME_OVERRIDES: Record<
  number,
  Partial<WreckedCarFrameCollisionProfile>
> = {};

/** Perfil base top-down (sem overrides). */
export function wreckedCarFrameCollisionProfileBase(
  _frame: number,
): WreckedCarFrameCollisionProfile {
  return {
    swapAxes: false,
    artRotation: 0,
    localOffsetX: 0,
    localOffsetY: 0,
  };
}

export function wreckedCarFrameCollisionProfile(
  frame: number,
): WreckedCarFrameCollisionProfile {
  const base = wreckedCarFrameCollisionProfileBase(frame);
  const code = WRECKED_CAR_FRAME_OVERRIDES[frame];
  const runtime = getRuntimeProfileOverride(frame);
  return { ...base, ...code, ...runtime };
}

export const CAR_POI_TYPE_IDS = new Set(['abandoned_car', 'car_trunk']);

/** @deprecated use CarObbSolid */
export interface CarCollisionRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Hitbox orientada — segue a rotação do sprite (sem cantos fantasma). */
export interface CarObbSolid {
  cx: number;
  cy: number;
  halfW: number;
  halfH: number;
  rotation: number;
}

/** Meias-extensões da hitbox alinhada ao sprite (antes da rotação). */
export function wreckedCarCollisionHalfExtents(tileSize: number): {
  halfW: number;
  halfH: number;
} {
  const scale = wreckedCarDisplayScale(tileSize);
  return {
    halfW:
      (WRECKED_CAR_FRAME_W *
        scale *
        WRECKED_CAR_COLLISION_WIDTH_FRAC *
        WRECKED_CAR_COLLISION_SIZE_MULT) /
      2,
    halfH:
      (WRECKED_CAR_FRAME_H *
        scale *
        WRECKED_CAR_COLLISION_HEIGHT_FRAC *
        WRECKED_CAR_COLLISION_SIZE_MULT) /
      2,
  };
}

/** Local → mundo (mesma convenção de rotação do Phaser). */
export function carObbLocalToWorld(
  cx: number,
  cy: number,
  rotation: number,
  lx: number,
  ly: number,
): { x: number; y: number } {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return {
    x: cx + lx * cos - ly * sin,
    y: cy + lx * sin + ly * cos,
  };
}

/** Quatro cantos da OBB em coordenadas de mundo. */
export function carObbWorldCorners(obb: CarObbSolid): { x: number; y: number }[] {
  const { cx, cy, halfW, halfH, rotation } = obb;
  return [
    carObbLocalToWorld(cx, cy, rotation, -halfW, -halfH),
    carObbLocalToWorld(cx, cy, rotation, halfW, -halfH),
    carObbLocalToWorld(cx, cy, rotation, halfW, halfH),
    carObbLocalToWorld(cx, cy, rotation, -halfW, halfH),
  ];
}

/** OBB centrada no sprite — mesma origem/escala/quadro do renderer. */
export function wreckedCarCollisionObb(
  cx: number,
  cy: number,
  tileSize: number,
  rotation: number,
  scaleMult = 1,
  frame?: number,
): CarObbSolid {
  const base = wreckedCarCollisionHalfExtents(tileSize);
  const profile =
    frame === undefined
      ? ({
          swapAxes: false,
          artRotation: 0,
          localOffsetX: 0,
          localOffsetY: 0,
        } satisfies WreckedCarFrameCollisionProfile)
      : wreckedCarFrameCollisionProfile(frame);

  let halfW = base.halfW;
  let halfH = base.halfH;
  if (profile.swapAxes) {
    halfW = base.halfH;
    halfH = base.halfW;
  }

  const rot = rotation + profile.artRotation;
  const scale = wreckedCarDisplayScale(tileSize) * scaleMult;
  const offX = profile.localOffsetX * WRECKED_CAR_FRAME_W * scale;
  const offY = profile.localOffsetY * WRECKED_CAR_FRAME_H * scale;
  const center = carObbLocalToWorld(cx, cy, rot, offX, offY);

  return {
    cx: center.x,
    cy: center.y,
    halfW: halfW * scaleMult,
    halfH: halfH * scaleMult,
    rotation: rot,
  };
}

/** AABB envolvente (legado / debug). */
export function wreckedCarCollisionRect(
  cx: number,
  cy: number,
  tileSize: number,
  rotation: number,
  scaleMult = 1,
): CarCollisionRect {
  const { halfW, halfH } = wreckedCarCollisionObb(
    cx,
    cy,
    tileSize,
    rotation,
    scaleMult,
  );
  const cos = Math.abs(Math.cos(rotation));
  const sin = Math.abs(Math.sin(rotation));
  const aw = halfW * 2 * cos + halfH * 2 * sin;
  const ah = halfW * 2 * sin + halfH * 2 * cos;
  return { x: cx - aw / 2, y: cy - ah / 2, w: aw, h: ah };
}

/** Círculo vs OBB (hitbox rotacionada). */
export function circleHitsCarObb(
  px: number,
  py: number,
  pr: number,
  obb: CarObbSolid,
): boolean {
  const cos = Math.cos(-obb.rotation);
  const sin = Math.sin(-obb.rotation);
  const dx = px - obb.cx;
  const dy = py - obb.cy;
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;
  const nx = Math.max(-obb.halfW, Math.min(obb.halfW, lx));
  const ny = Math.max(-obb.halfH, Math.min(obb.halfH, ly));
  const ddx = lx - nx;
  const ddy = ly - ny;
  return ddx * ddx + ddy * ddy < pr * pr;
}

/** Raio vs OBB — distância de entrada ao longo do raio, ou null. */
export function rayCarObbDistance(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  obb: CarObbSolid,
): number | null {
  const cos = Math.cos(-obb.rotation);
  const sin = Math.sin(-obb.rotation);
  const lx = ox - obb.cx;
  const ly = oy - obb.cy;
  const rox = lx * cos - ly * sin;
  const roy = lx * sin + ly * cos;
  const rdx = dx * cos - dy * sin;
  const rdy = dx * sin + dy * cos;

  let tmin = -Infinity;
  let tmax = Infinity;
  const minX = -obb.halfW;
  const maxX = obb.halfW;
  const minY = -obb.halfH;
  const maxY = obb.halfH;

  if (Math.abs(rdx) < 1e-12) {
    if (rox < minX || rox > maxX) return null;
  } else {
    const t1 = (minX - rox) / rdx;
    const t2 = (maxX - rox) / rdx;
    tmin = Math.max(tmin, Math.min(t1, t2));
    tmax = Math.min(tmax, Math.max(t1, t2));
  }

  if (Math.abs(rdy) < 1e-12) {
    if (roy < minY || roy > maxY) return null;
  } else {
    const t1 = (minY - roy) / rdy;
    const t2 = (maxY - roy) / rdy;
    tmin = Math.max(tmin, Math.min(t1, t2));
    tmax = Math.min(tmax, Math.max(t1, t2));
  }

  if (tmax < 0 || tmin > tmax) return null;
  const t = tmin >= 0 ? tmin : tmax;
  return t >= 0 ? t : null;
}

/** Sólidos OBB para carros abandonados e tombados. */
export function collectWreckedCarObbs(city: {
  tileSize: number;
  ambientProps: readonly {
    id: string;
    kind: string;
    x: number;
    y: number;
    rotation: number;
    scale?: number;
    frame?: number;
  }[];
  explorationPoints: readonly {
    id: string;
    typeId: string;
    x: number;
    y: number;
  }[];
}): CarObbSolid[] {
  const ts = city.tileSize;
  const obbs: CarObbSolid[] = [];

  for (const p of city.ambientProps) {
    if (p.kind !== 'wrecked_car') continue;
    const frame = p.frame ?? pickWreckedCarFrame(p.id);
    obbs.push(
      wreckedCarCollisionObb(
        p.x * ts + ts / 2,
        p.y * ts + ts / 2,
        ts,
        p.rotation,
        p.scale ?? 1,
        frame,
      ),
    );
  }

  for (const poi of city.explorationPoints) {
    if (!CAR_POI_TYPE_IDS.has(poi.typeId)) continue;
    const frame = pickWreckedCarFrame(poi.id);
    obbs.push(
      wreckedCarCollisionObb(
        poi.x * ts + ts / 2,
        poi.y * ts + ts / 2,
        ts,
        stableCarRotation(poi.id),
        1,
        frame,
      ),
    );
  }

  return obbs;
}

/** @deprecated use collectWreckedCarObbs */
export function collectWreckedCarSolids(city: Parameters<
  typeof collectWreckedCarObbs
>[0]): CarCollisionRect[] {
  return collectWreckedCarObbs(city).map((o) =>
    wreckedCarCollisionRect(o.cx, o.cy, city.tileSize, o.rotation),
  );
}
