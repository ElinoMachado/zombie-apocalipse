import {
  createWeaponInstance,
  type WeaponDef,
  type WeaponInstance,
} from './weapons';
import { ITEMS, type ItemId } from '../inventory/inventory';

const MELEE_RANGE_PX = 42;
const RANGED_RANGE_PX = 15.75;

const FIREARM_DAMAGE_SCALE = 1 / 3;
const MELEE_DAMAGE_SCALE = 0.45;

/** Converte stats do catálogo para combate (px, dano balanceado). */
export function weaponDefFromItem(itemId: ItemId): WeaponDef | null {
  const item = ITEMS[itemId];
  if (!item?.weapon) return null;

  const w = item.weapon;
  const isFirearm = item.category === 'firearm';
  const kind = isFirearm ? 'ranged' : 'melee';
  const scale = isFirearm ? FIREARM_DAMAGE_SCALE : MELEE_DAMAGE_SCALE;
  const damageMin = Math.max(1, Math.round(w.damageMin * scale));
  const damageMax = Math.max(
    damageMin,
    Math.round(w.damageMax * scale),
  );
  const range = isFirearm
    ? Math.round(w.range * RANGED_RANGE_PX)
    : Math.round(w.range * MELEE_RANGE_PX);

  return {
    id: itemId,
    label: item.label,
    kind,
    damageMin,
    damageMax,
    cooldownSec: w.cooldownSec,
    range,
    projectileSpeed: isFirearm ? 520 : undefined,
    accuracy: w.accuracy,
    slashHalfAngle: kind === 'melee' ? Math.PI / 3 : undefined,
    magSize: w.magSize ?? (isFirearm ? 4 : undefined),
    startingReserve: 0,
    reloadSec: isFirearm ? Math.max(1.4, w.cooldownSec * 2.5) : undefined,
    maxDurability: w.durability ?? (kind === 'melee' ? 100 : undefined),
    durabilityCost: kind === 'melee' ? 4 : undefined,
    noisy: isFirearm && w.noise >= 7,
  };
}

export function createWeaponFromItem(itemId: ItemId): WeaponInstance | null {
  const def = weaponDefFromItem(itemId);
  if (!def) return null;
  return {
    def,
    ammoInMag: def.magSize ?? 0,
    reserve: def.startingReserve ?? 0,
    durability: def.maxDurability ?? 0,
    cooldownLeft: 0,
  };
}

/** Instancia arma legada ou do catálogo. */
export function createWeaponFromId(id: string): WeaponInstance {
  const fromItem = createWeaponFromItem(id as ItemId);
  if (fromItem) return fromItem;
  return createWeaponInstance(id as 'pistol' | 'knife');
}
