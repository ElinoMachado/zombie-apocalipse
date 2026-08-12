/**
 * Força / densidade em função da proximidade ao centro da cidade.
 * proximity 0 = borda (longe) · 1 = centro.
 */

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

/** 1 no centro, 0 na periferia. */
export function proximityFromCenter(distNorm: number): number {
  return 1 - Math.max(0, Math.min(1, distNorm));
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
 * Densidade relativa de spawn: centro = hordas, periferia = esparsos.
 * Retorna peso 0.15–1.0.
 */
export function spawnDensityWeight(proximity: number): number {
  return lerp(0.15, 1, proximity * proximity);
}

/**
 * Espaçamento mínimo entre inimigos (px): menor no centro (horda), maior longe.
 */
export function enemySpacingPx(proximity: number, tileSize: number): number {
  return lerp(tileSize * 1.1, tileSize * 4.5, 1 - proximity);
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
