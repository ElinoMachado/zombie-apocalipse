import type { Rng } from '../../world/rng/Rng';

export type CharacterSex = 'Masculino' | 'Feminino' | 'Outro';
export type CharacterTendency = 'Leal' | 'Neutro' | 'Caótico';

export interface CharacterProfile {
  name: string;
  age: number;
  sex: CharacterSex;
  profession: string;
  religion: string;
  tendency: CharacterTendency;
}

const FIRST_NAMES = [
  'Ana',
  'Bruno',
  'Carla',
  'Diego',
  'Elena',
  'Felipe',
  'Gabriela',
  'Henrique',
  'Isabel',
  'João',
  'Karina',
  'Lucas',
  'Mariana',
  'Nicolas',
  'Olivia',
  'Paulo',
  'Renata',
  'Samuel',
  'Tatiana',
  'Vitor',
];

const LAST_NAMES = [
  'Almeida',
  'Barros',
  'Costa',
  'Dias',
  'Ferreira',
  'Gomes',
  'Lima',
  'Mendes',
  'Nogueira',
  'Oliveira',
  'Pereira',
  'Ribeiro',
  'Silva',
  'Souza',
  'Teixeira',
];

const PROFESSIONS = [
  'Médico',
  'Enfermeiro',
  'Professor',
  'Mecânico',
  'Engenheiro',
  'Policial',
  'Bombeiro',
  'Chef',
  'Estudante',
  'Vendedor',
  'Contador',
  'Jornalista',
  'Veterinário',
  'Eletricista',
  'Agricultor',
];

const RELIGIONS = [
  'Católica',
  'Evangélica',
  'Espírita',
  'Agnóstico',
  'Ateu',
  'Umbanda',
  'Budista',
  'Muçulmano',
  'Judaica',
  'Sem religião',
];

const TENDENCIES: CharacterTendency[] = ['Leal', 'Neutro', 'Caótico'];
const SEXES: CharacterSex[] = ['Masculino', 'Feminino', 'Outro'];

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

/** Gera dados pessoais aleatórios para a ficha. */
export function generateCharacterProfile(rng: () => number = Math.random): CharacterProfile {
  return {
    name: `${pick(FIRST_NAMES, rng)} ${pick(LAST_NAMES, rng)}`,
    age: 18 + Math.floor(rng() * 48),
    sex: pick(SEXES, rng),
    profession: pick(PROFESSIONS, rng),
    religion: pick(RELIGIONS, rng),
    tendency: pick(TENDENCIES, rng),
  };
}

/** Variante com Rng do gerador de mundo. */
export function generateCharacterProfileFromRng(rng: Rng): CharacterProfile {
  return generateCharacterProfile(() => rng.next());
}
