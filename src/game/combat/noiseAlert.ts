/** Alerta de barulho: 4d4 ao disparar arma ruidosa (pistola). */

export const NOISE_DICE_COUNT = 4;
export const NOISE_DIE_SIDES = 4;

export interface NoiseRollResult {
  dice: number[];
  /** Quantos dados saíram no máximo (4). */
  maxHits: number;
  /** Todos os dados = 4 → spawna elite. */
  elite: boolean;
  /** Algum 4 (mas não 4/4/4/4) → atrai o zumbi mais próximo. */
  noiseHeard: boolean;
}

export function rollDie(sides: number, rng = Math.random): number {
  return 1 + Math.floor(rng() * sides);
}

export function roll4d4(rng = Math.random): number[] {
  return Array.from({ length: NOISE_DICE_COUNT }, () =>
    rollDie(NOISE_DIE_SIDES, rng),
  );
}

export function interpretNoiseRoll(dice: number[]): NoiseRollResult {
  const maxHits = dice.filter((d) => d === NOISE_DIE_SIDES).length;
  const elite = maxHits === NOISE_DICE_COUNT;
  return {
    dice,
    maxHits,
    elite,
    noiseHeard: maxHits > 0 && !elite,
  };
}

export function rollNoiseAlert(rng = Math.random): NoiseRollResult {
  return interpretNoiseRoll(roll4d4(rng));
}
