import { stableHash01 } from './wreckedCars';

const QUARTER = Math.PI / 2;

/** 0 ou π — sprite deitado (eixo longo horizontal). */
export function stableFlatRotation(seed: string, salt = 'flat'): number {
  return stableHash01(`${seed}:${salt}`) < 0.5 ? 0 : Math.PI;
}

/**
 * Em pé (π/2 ou 3π/2) ou deitado (0 ou π) — nunca diagonal.
 */
export function stableUprightOrFlatRotation(seed: string, salt = 'cardinal'): number {
  const flat = stableHash01(`${seed}:${salt}`) < 0.5;
  const flip = stableHash01(`${seed}:${salt}:dir`) < 0.5;
  if (flat) return flip ? 0 : Math.PI;
  return flip ? QUARTER : 3 * QUARTER;
}
