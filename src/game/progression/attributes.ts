/** Atributos do personagem (base 10, modificador estilo D&D). */

export type AttributeId =
  | 'strength'
  | 'aim'
  | 'reflexes'
  | 'sanity'
  | 'intellect'
  | 'charisma'
  | 'vitality'
  | 'luck'
  | 'courage';

export const ATTRIBUTE_IDS: AttributeId[] = [
  'strength',
  'aim',
  'reflexes',
  'sanity',
  'intellect',
  'charisma',
  'vitality',
  'luck',
  'courage',
];

export const ATTRIBUTE_LABELS: Record<AttributeId, string> = {
  strength: 'Força',
  aim: 'Mira',
  reflexes: 'Reflexos',
  sanity: 'Sanidade',
  intellect: 'Intelecto',
  charisma: 'Carisma',
  vitality: 'Vitalidade',
  luck: 'Sorte',
  courage: 'Coragem',
};

export const BASE_ATTRIBUTE = 10;
export const BASE_AC = 10;
/** CA base dos inimigos (sem equipamento). */
export const ENEMY_BASE_AC = 10;

export type AttributeScores = Record<AttributeId, number>;

export function defaultAttributes(): AttributeScores {
  return {
    strength: BASE_ATTRIBUTE,
    aim: BASE_ATTRIBUTE,
    reflexes: BASE_ATTRIBUTE,
    sanity: BASE_ATTRIBUTE,
    intellect: BASE_ATTRIBUTE,
    charisma: BASE_ATTRIBUTE,
    vitality: BASE_ATTRIBUTE,
    luck: BASE_ATTRIBUTE,
    courage: BASE_ATTRIBUTE,
  };
}

/** +1 a cada 2 pontos acima de 10 (D&D). */
export function attributeModifier(score: number): number {
  return Math.floor((score - BASE_ATTRIBUTE) / 2);
}

export function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : String(mod);
}

export function playerAC(reflexes: number): number {
  return BASE_AC + attributeModifier(reflexes);
}

/** Vida extra = modificador de Vitalidade × nível. */
export function vitalityHpBonus(vitality: number, level: number): number {
  const mod = attributeModifier(vitality);
  if (mod <= 0 || level <= 0) return 0;
  return mod * level;
}
