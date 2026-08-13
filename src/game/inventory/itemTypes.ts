/** Tipos partilhados do catálogo de itens. */

export type ItemRarity =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'super_rare'
  | 'ultra_rare'
  | 'top_secret'
  /** @deprecated Alias legado — equivale a super_rare no loot antigo. */
  | 'legendary';

export type ItemCategory =
  | 'consumable'
  | 'component'
  | 'utility'
  | 'melee_weapon'
  | 'firearm'
  | 'explosive'
  | 'armor'
  | 'backpack'
  | 'footwear'
  | 'accessory'
  | 'legacy';

export interface WeaponItemStats {
  damageMin: number;
  damageMax: number;
  cooldownSec: number;
  range: number;
  noise: number;
  /** 0–1 chance base (armas de fogo legado; combate usa 1d20). */
  accuracy?: number;
  weaponType: string;
  durability?: number;
  magSize?: number;
  ammoType?: string;
  fireMode?: string;
  /** efeitos especiais: atordoamento, sangramento, perfurante, etc. */
  traits?: string[];
}

export interface EquipItemStats {
  armor?: number;
  noiseMod?: number;
  stealthMod?: number;
  capacityBonus?: number;
  slotBonus?: number;
  speedMod?: number;
  perceptionMod?: number;
  durability?: number;
  effect?: string;
}

export interface ConsumableItemStats {
  uses: number;
  effect: string;
}

export interface ItemDefBase {
  label: string;
  rarity: ItemRarity;
  category: ItemCategory;
  weight: number;
  maxStack: number;
  description: string;
  color?: number;
  consumable?: ConsumableItemStats;
  weapon?: WeaponItemStats;
  equip?: EquipItemStats;
}

export const RARITY_LABEL: Record<ItemRarity, string> = {
  common: 'Comum',
  uncommon: 'Incomum',
  rare: 'Raro',
  super_rare: 'Super Raro',
  ultra_rare: 'Ultra Raro',
  top_secret: 'Top Secret',
  legendary: 'Lendário',
};

/** Cores por raridade (menor → maior): branco, verde, azul, roxo, laranja, vermelho. */
export const RARITY_COLOR: Record<ItemRarity, number> = {
  common: 0xffffff,
  uncommon: 0x4ade80,
  rare: 0x3b82f6,
  super_rare: 0xa855f7,
  ultra_rare: 0xf97316,
  top_secret: 0xef4444,
  legendary: 0xa855f7,
};

export const CATEGORY_LABEL: Record<ItemCategory, string> = {
  consumable: 'Consumível',
  component: 'Componente',
  utility: 'Utilidade',
  melee_weapon: 'Arma branca',
  firearm: 'Arma de fogo',
  explosive: 'Explosiva / especial',
  armor: 'Protecção',
  backpack: 'Mochila / carga',
  footwear: 'Calçado',
  accessory: 'Acessório',
  legacy: 'Legado',
};

/** Ordem crescente de raridade (loot / comparações). */
export const RARITY_ORDER: ItemRarity[] = [
  'common',
  'uncommon',
  'rare',
  'super_rare',
  'ultra_rare',
  'top_secret',
];

export function normalizeRarity(r: ItemRarity): ItemRarity {
  return r === 'legendary' ? 'super_rare' : r;
}

export function rarityColor(r: ItemRarity): number {
  return RARITY_COLOR[normalizeRarity(r)];
}
