/** Stats de movimento / estamina (sem Phaser — testável em Node). */

export const PLAYER_MAX_HP = 16;
export const PLAYER_MAX_STAMINA = 100;

/** Velocidade ao agachar (stealth). */
export const CROUCH_SPEED_MULT = 0.42;

/**
 * Referência: zumbi típico (prox 0.5) a perseguir.
 * Passo = 5% mais lento; corrida = 30% mais rápido.
 */
export const ZOMBIE_REF_CHASE_SPEED = (28 + 11) * 0.6 * 1.35;
export const PLAYER_WALK_SPEED = ZOMBIE_REF_CHASE_SPEED * 0.95;
export const PLAYER_SPRINT_SPEED = ZOMBIE_REF_CHASE_SPEED * 1.3;
/** Mult. de corrida relativo ao passo. */
export const SPRINT_SPEED_MULT = PLAYER_SPRINT_SPEED / PLAYER_WALK_SPEED;

/** Andar de costas (movimento oposto à mira). */
export const BACKPEDAL_SPEED_MULT = 0.5;

/**
 * Produto escalar movimento·mira (−1 costas, +1 frente).
 * dx/dy normalizados (ou não-zero).
 */
export function moveAimDot(
  dx: number,
  dy: number,
  aimAngle: number,
): number {
  return dx * Math.cos(aimAngle) + dy * Math.sin(aimAngle);
}

/** True se movimento no hemisfério oposto à mira. */
export function isMovingBackwards(
  dx: number,
  dy: number,
  aimAngle: number,
): boolean {
  return moveAimDot(dx, dy, aimAngle) < 0;
}

/**
 * Mult. contínuo: 1 à frente / lateral, até {@link BACKPEDAL_SPEED_MULT} de costas.
 * Evita salto brusco a 90° (fonte de “tremor” de velocidade).
 */
export function backpedalSpeedFactor(
  dx: number,
  dy: number,
  aimAngle: number,
): number {
  const forward = moveAimDot(dx, dy, aimAngle);
  if (forward >= 0) return 1;
  return 1 + forward * (1 - BACKPEDAL_SPEED_MULT);
}

/** Consumo / regen de estamina (unidades/s). */
export const STAMINA_CROUCH_DRAIN = 11;
export const STAMINA_SPRINT_DRAIN = 16;
export const STAMINA_REGEN = 7;
