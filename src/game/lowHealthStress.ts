/** Fração de vida 0…1. */
export function hpRatio(hp: number, maxHp: number): number {
  if (maxHp <= 0) return 0;
  return Math.max(0, Math.min(1, hp / maxHp));
}

/** Intensidade do stress visual (0 acima de 75% HP → 1 perto de 0%). */
export function lowHealthStress(ratio: number): number {
  if (ratio > 0.75) return 0;
  const t = (0.75 - ratio) / 0.75;
  return Math.min(1, Math.pow(Math.max(0, t), 0.82));
}

export type HeartbeatTier = 75 | 50 | 30;

/** Faixa de heartbeat conforme % de vida (null se > 75%). */
export function pickHeartbeatTier(ratio: number): HeartbeatTier | null {
  if (ratio > 0.75) return null;
  if (ratio <= 0.3) return 30;
  if (ratio <= 0.5) return 50;
  return 75;
}

export const HEARTBEAT_ATTACKED_SEC = 3;

export const HEARTBEAT_TIER_SEC: Record<HeartbeatTier, number> = {
  75: 3,
  50: 6,
  30: 20,
};
