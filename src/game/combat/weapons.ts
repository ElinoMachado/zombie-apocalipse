export type WeaponId = string;

export type WeaponKind = 'ranged' | 'melee';

export interface WeaponDef {
  id: WeaponId;
  label: string;
  kind: WeaponKind;
  /** Dano mínimo / máximo por acerto. */
  damageMin: number;
  damageMax: number;
  /** Segundos entre disparos / golpes. */
  cooldownSec: number;
  /** Alcance do projétil ou do arco (px). */
  range: number;
  /** Velocidade do projétil (px/s) — só ranged. */
  projectileSpeed?: number;
  /**
   * Precisão 0–1 (legado; combate usa 1d20 vs CA).
   * @deprecated
   */
  accuracy?: number;
  /** Meia-abertura do slash em radianos — só melee. */
  slashHalfAngle?: number;
  magSize?: number;
  /** Reserva inicial (fora do carregador). */
  startingReserve?: number;
  /** Duração do reload (s) — só ranged. */
  reloadSec?: number;
  /** Durabilidade máxima — só melee. */
  maxDurability?: number;
  /** Custo de durabilidade por golpe. */
  durabilityCost?: number;
  /** Disparo/ataque faz rolagem de barulho (4d4). */
  noisy?: boolean;
}

/** Chance de o inimigo bloquear um acerto (50% do dano). */
export const ENEMY_BLOCK_CHANCE = 0.01;
export const BLOCK_DAMAGE_MULT = 0.5;

/** 0.33 disparos/s → ~3.03 s entre tiros. */
export const PISTOL_FIRE_RATE = 0.33;

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistol: {
    id: 'pistol',
    label: 'Pistola',
    kind: 'ranged',
    damageMin: 4,
    damageMax: 8,
    cooldownSec: 1 / PISTOL_FIRE_RATE,
    range: 42 * 3, // triplo da faca
    projectileSpeed: 520,
    accuracy: 0.72,
    magSize: 4,
    startingReserve: 0,
    reloadSec: 2.2,
    noisy: true,
  },
  knife: {
    id: 'knife',
    label: 'Faca',
    kind: 'melee',
    damageMin: 2,
    damageMax: 6,
    cooldownSec: 2,
    range: 42,
    slashHalfAngle: Math.PI / 3,
    maxDurability: 100,
    durabilityCost: 4,
    noisy: false,
  },
};

export function rollWeaponDamage(
  def: WeaponDef,
  rng = Math.random,
): number {
  const { damageMin: min, damageMax: max } = def;
  if (max <= min) return min;
  return min + Math.floor(rng() * (max - min + 1));
}

export interface WeaponInstance {
  def: WeaponDef;
  /** Munição no carregador (ranged). */
  ammoInMag: number;
  /** Reserva fora do carregador (ranged). */
  reserve: number;
  /** Durabilidade actual (melee). */
  durability: number;
  cooldownLeft: number;
}

/** Estado de reload timed da arma ranged. */
export interface ReloadState {
  active: boolean;
  /** Segundos restantes. */
  left: number;
  /** Duração total deste reload. */
  duration: number;
}

export function createReloadState(): ReloadState {
  return { active: false, left: 0, duration: 0 };
}

export function createWeaponInstance(id: WeaponId): WeaponInstance {
  const def = WEAPONS[id as keyof typeof WEAPONS];
  if (!def) {
    throw new Error(`Arma desconhecida: ${id}`);
  }
  return {
    def,
    ammoInMag: def.magSize ?? 0,
    reserve: def.startingReserve ?? 0,
    durability: def.maxDurability ?? 0,
    cooldownLeft: 0,
  };
}

/** Pode iniciar reload? Mag incompleto + reserva. */
export function canStartReload(w: WeaponInstance): boolean {
  const mag = w.def.magSize ?? 0;
  return mag > 0 && w.ammoInMag < mag && w.reserve > 0;
}

/** Transfere reserva → carregador (fim do reload). */
export function finishReload(w: WeaponInstance): void {
  const mag = w.def.magSize ?? 0;
  if (mag <= 0 || w.reserve <= 0) return;
  const need = mag - w.ammoInMag;
  const take = Math.min(need, w.reserve);
  w.ammoInMag += take;
  w.reserve -= take;
}

/** Ex.: 4/0 — no pente / reserva (fora do pente). */
export function rangedAmmoLabel(w: WeaponInstance): string {
  return `${w.ammoInMag}/${w.reserve}`;
}

export function reloadProgress(state: ReloadState): number {
  if (!state.active || state.duration <= 0) return 0;
  return 1 - state.left / state.duration;
}

export function meleeDurabilityRatio(w: WeaponInstance): number {
  const max = w.def.maxDurability ?? 1;
  return Math.max(0, Math.min(1, w.durability / max));
}
