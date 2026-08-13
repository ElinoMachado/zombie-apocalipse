import type { CitySizeClass } from '../../world/model/types';

/**
 * Força / densidade em função da proximidade ao centro da cidade.
 * proximity 0 = borda (longe) · 1 = centro.
 */

/** Meta total de inimigos por cidade (aberto + interiores — interiores ainda não spawnados). */
export const CITY_ENEMY_TOTAL: Record<CitySizeClass, number> = {
  small: 5000,
  medium: 10_000,
  large: 20_000,
};

/** Inimigos no mundo aberto (spawn actual no mapa). */
export const OPEN_WORLD_ENEMY_COUNT: Record<CitySizeClass, number> = {
  small: 2000,
  medium: 4000,
  large: 8000,
};

export function openWorldEnemyCount(sizeClass: CitySizeClass): number {
  return OPEN_WORLD_ENEMY_COUNT[sizeClass];
}

export const ENEMY_HP_MIN = 6;
export const ENEMY_HP_MAX = 20;
export const ENEMY_DMG_FAR = { min: 1, max: 2 } as const;
export const ENEMY_DMG_NEAR = { min: 4, max: 12 } as const;

export function cityRadiusTiles(gridW: number, gridH: number): number {
  return Math.hypot(gridW / 2, gridH / 2) || 1;
}

/** Distância normalizada ao centro em tiles (0 centro → 1+ borda). */
export function centerDistanceNorm(
  tileX: number,
  tileY: number,
  centerX: number,
  centerY: number,
  gridW: number,
  gridH: number,
): number {
  const d = Math.hypot(tileX - centerX, tileY - centerY);
  return Math.min(1, d / cityRadiusTiles(gridW, gridH));
}

/** 1 no centro, 0 na periferia/rural (curva cúbica = contraste forte). */
export function proximityFromCenter(distNorm: number): number {
  const t = 1 - Math.max(0, Math.min(1, distNorm));
  return t * t * t;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function enemyHpForProximity(proximity: number): number {
  return Math.round(lerp(ENEMY_HP_MIN, ENEMY_HP_MAX, proximity));
}

export function enemyDamageRange(proximity: number): { min: number; max: number } {
  return {
    min: Math.round(lerp(ENEMY_DMG_FAR.min, ENEMY_DMG_NEAR.min, proximity)),
    max: Math.round(lerp(ENEMY_DMG_FAR.max, ENEMY_DMG_NEAR.max, proximity)),
  };
}

export function rollDamage(min: number, max: number, rng = Math.random): number {
  if (max <= min) return min;
  return min + Math.floor(rng() * (max - min + 1));
}

/**
 * Densidade relativa de spawn: centro = hordas densas, rural = quase vazio.
 * Retorna peso ~0.02–1.0.
 */
export function spawnDensityWeight(proximity: number): number {
  return lerp(0.02, 1, proximity);
}

/**
 * Espaçamento mínimo entre inimigos (px): hordas no centro, muito espaçado na periferia.
 */
export function enemySpacingPx(proximity: number, tileSize: number): number {
  const tight = tileSize * 0.75;
  const sparse = tileSize * 9;
  return lerp(sparse, tight, proximity * proximity);
}

/** Peso extra por zona ao colocar POIs / tentar spawn. */
export const ZONE_THREAT_WEIGHT: Partial<Record<string, number>> = {
  center: 1.6,
  commercial: 1.25,
  mixed: 1.1,
  residential_med: 1,
  residential_low: 0.75,
  suburban: 0.35,
  periphery: 0.3,
  industrial: 0.55,
  rural: 0.06,
};

export function zoneThreatWeight(zone: string): number {
  return ZONE_THREAT_WEIGHT[zone] ?? 0.4;
}

/**
 * Tile aleatório com viés forte para o centro (potência radial).
 */
export function pickCenterBiasedTile(
  rng: { float: (min: number, max: number) => number },
  gridW: number,
  gridH: number,
  centerX: number,
  centerY: number,
  margin = 2,
): { tx: number; ty: number } {
  const angle = rng.float(0, Math.PI * 2);
  const t = Math.pow(rng.float(0, 1), 3.2);
  const maxR = Math.hypot(gridW / 2, gridH / 2);
  let tx = centerX + Math.cos(angle) * t * maxR;
  let ty = centerY + Math.sin(angle) * t * maxR;
  tx = Math.max(margin, Math.min(gridW - margin - 1, tx));
  ty = Math.max(margin, Math.min(gridH - margin - 1, ty));
  return { tx, ty };
}

/** Raio mínimo (px) entre o spawn do jogador e inimigos iniciais. */
export function playerSpawnClearancePx(tileSize: number): number {
  return Math.max(160, tileSize * 10);
}

export function isWithinRadiusPx(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  radius: number,
): boolean {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy < radius * radius;
}
