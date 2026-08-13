import { rollDamage } from './cityThreat';

export interface ZombieMeleeResult {
  damage: number;
  /** Natural 20 no d20 de ataque corpo-a-corpo. */
  critical: boolean;
}

/**
 * Golpe de zumbi em contacto: rola dano e um d20 de ataque.
 * Crítico (20) → sangramento no jogador; dano mantém-se na rolagem normal.
 */
export function resolveZombieMeleeAttack(
  damageMin: number,
  damageMax: number,
  rng = Math.random,
): ZombieMeleeResult {
  const damage = rollDamage(damageMin, damageMax, rng);
  const attackRoll = 1 + Math.floor(rng() * 20);
  return { damage, critical: attackRoll === 20 };
}
