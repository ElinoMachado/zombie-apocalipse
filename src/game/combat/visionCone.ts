/** Utilitários de cone / ângulo para visão e backstab. */

export const ZOMBIE_VISION_HALF_ANGLE = Math.PI / 4; // 90° total
export const ZOMBIE_VISION_RANGE_MULT = 1.5;
/** Fronteira interna/externa = metade do raio. */
export const ZOMBIE_VISION_INNER_RATIO = 0.5;
/** Atrás do zumbi: ângulo face→jogador > 90° = backstab. */
export const BACKSTAB_MIN_ANGLE = Math.PI / 2;

export function normalizeAngleDelta(delta: number): number {
  let d = delta;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function angleBetween(a: number, b: number): number {
  return Math.abs(normalizeAngleDelta(a - b));
}

/** Ponto dentro do cone (meia-abertura `halfAngle`). */
export function inCone(
  ox: number,
  oy: number,
  facing: number,
  tx: number,
  ty: number,
  range: number,
  halfAngle: number,
): boolean {
  const dx = tx - ox;
  const dy = ty - oy;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return false;
  if (dist < 1e-4) return true;
  const ang = Math.atan2(dy, dx);
  return angleBetween(ang, facing) <= halfAngle;
}

/**
 * Detecção: em stealth só vale a metade interna do cone;
 * fora de stealth vale o cone completo.
 */
export function canDetectInVision(
  ox: number,
  oy: number,
  facing: number,
  tx: number,
  ty: number,
  outerRange: number,
  halfAngle: number,
  targetStealthed: boolean,
): boolean {
  const range = targetStealthed
    ? outerRange * ZOMBIE_VISION_INNER_RATIO
    : outerRange;
  return inCone(ox, oy, facing, tx, ty, range, halfAngle);
}

/** Atacante está nas costas do alvo (backstab). */
export function isBackstabPosition(
  targetX: number,
  targetY: number,
  targetFacing: number,
  attackerX: number,
  attackerY: number,
): boolean {
  const dx = attackerX - targetX;
  const dy = attackerY - targetY;
  if (Math.hypot(dx, dy) < 1e-4) return false;
  const fromTarget = Math.atan2(dy, dx);
  return angleBetween(fromTarget, targetFacing) >= BACKSTAB_MIN_ANGLE;
}
