import { stableHash01 } from './wreckedCars';

const QUARTER = Math.PI / 2;

/** Rotações cardinais sem inverter o sprite (sem π). */
export const UPRIGHT_CARDINALS = [0, QUARTER, 3 * QUARTER] as const;

function pickWeighted(
  seed: string,
  salt: string,
  weights: readonly { angle: number; w: number }[],
): number {
  const h = stableHash01(`${seed}:${salt}`);
  let acc = 0;
  for (const { angle, w } of weights) {
    acc += w;
    if (h < acc) return angle;
  }
  return weights[weights.length - 1]!.angle;
}

/**
 * Props com topo/base óbvios (caixa, mala): orientação do artista ou 90°/270°.
 * Nunca π — evita caixa/mochila de ponta-cabeça.
 */
export function stableUprightRotation(seed: string, salt = 'upright'): number {
  return pickWeighted(seed, salt, [
    { angle: 0, w: 0.58 },
    { angle: QUARTER, w: 0.21 },
    { angle: 3 * QUARTER, w: 0.21 },
  ]);
}

/** Mochilas: quase sempre na pose default do sprite. */
export function stableBackpackNaturalRotation(seed: string): number {
  return pickWeighted(seed, 'backpack-rot', [
    { angle: 0, w: 0.8 },
    { angle: QUARTER, w: 0.1 },
    { angle: 3 * QUARTER, w: 0.1 },
  ]);
}

/**
 * Contêineres pesados no chão: default ou 90°, nunca invertidos.
 */
export function stableContainerNaturalRotation(seed: string): number {
  return pickWeighted(seed, 'container-rot', [
    { angle: 0, w: 0.68 },
    { angle: QUARTER, w: 0.32 },
  ]);
}

/**
 * Cadáveres no chão: cardinais (qualquer direção), sem inclinações diagonais.
 */
export function stableGroundLyingRotation(seed: string, salt = 'ground'): number {
  const h = stableHash01(`${seed}:${salt}`);
  const angles = [0, QUARTER, Math.PI, 3 * QUARTER];
  return angles[Math.floor(h * angles.length) % angles.length]!;
}

/** @deprecated Use {@link stableContainerNaturalRotation}. */
export function stableFlatRotation(seed: string, salt = 'flat'): number {
  return stableContainerNaturalRotation(`${seed}:${salt}`);
}

/** @deprecated Use {@link stableUprightRotation}. */
export function stableUprightOrFlatRotation(seed: string, salt = 'cardinal'): number {
  return stableUprightRotation(seed, salt);
}
