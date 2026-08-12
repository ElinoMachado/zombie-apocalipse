/** Catálogo de talentos / habilidades (nv1–nv6). */

export type TalentCategory =
  | 'ranged'
  | 'melee'
  | 'unarmed'
  | 'speed'
  | 'exploration'
  | 'resistance';

export type TalentId = string;

export const TALENT_MAX_LEVEL = 6;

export const TALENT_CATEGORY_LABELS: Record<TalentCategory, string> = {
  ranged: 'Longo Alcance',
  melee: 'Corpo a Corpo',
  unarmed: 'Mãos Nuas',
  speed: 'Velocidade',
  exploration: 'Exploração',
  resistance: 'Resistência',
};

export interface TalentDef {
  id: TalentId;
  name: string;
  category: TalentCategory;
  maxLevel: number;
  /** Texto do bónus por nível (índice 0 = nv1). */
  levelBonuses: readonly string[];
  /** Nota especial (prestígio, nv6+, etc.). */
  note?: string;
}

function six(
  id: string,
  name: string,
  category: TalentCategory,
  b1: string,
  b2: string,
  b3: string,
  b4: string,
  b5: string,
  b6: string,
  note?: string,
): TalentDef {
  return {
    id,
    name,
    category,
    maxLevel: TALENT_MAX_LEVEL,
    levelBonuses: [b1, b2, b3, b4, b5, b6],
    note,
  };
}

export const TALENTS: TalentDef[] = [
  // — Longo Alcance —
  six(
    'visao_aprimorada',
    'Visão aprimorada',
    'ranged',
    '+100 m de alcance de visão',
    '+200 m',
    '+300 m',
    '+400 m',
    '+500 m',
    '+1000 m',
  ),
  six(
    'camuflagem_perfeita',
    'Camuflagem perfeita',
    'ranged',
    '—',
    '—',
    '—',
    '—',
    '—',
    'Se camuflado: vantagem no ataque contra qualquer alvo',
    'Efeito completo no nv6',
  ),
  six(
    'projeteis_penetrantes',
    'Projéteis penetrantes',
    'ranged',
    'Penetrante: +1 inimigo',
    '+2 inimigos',
    '+3 inimigos',
    '+4 inimigos',
    '+6 inimigos',
    '+10 inimigos',
  ),
  six(
    'observador',
    'Observador',
    'ranged',
    '+1 em testes de observação',
    '+3',
    '+5',
    '+8',
    '+12',
    'Crítico garantido em observação',
  ),
  six(
    'olhos_de_aguia',
    'Olhos de águia',
    'ranged',
    '+2 acerto (longo alcance)',
    '+4',
    '+6',
    '+8',
    '+12',
    'Prestígio: acerto garantido',
  ),
  six(
    'precisao_cirurgica',
    'Precisão cirúrgica',
    'ranged',
    '+2 alvo específico',
    '+4',
    '+8',
    '+12',
    'Prestígio: acerto garantido',
    'Prestígio: acerto garantido',
  ),
  six(
    'tiro_pesado',
    'Tiro pesado',
    'ranged',
    '+3 dano longo alcance · crítico natural −1',
    '+6 · −2',
    '+9 · −3',
    '+12 · −4',
    '+20 · −5',
    '+70 · −6',
  ),
  six(
    'corte_limpo',
    'Corte limpo',
    'ranged',
    'Teste Mutilar (CD 18) · +4',
    '+6',
    '+8',
    '+10',
    '+16',
    '+18 · amputar membros (armas cortantes)',
  ),
  six(
    'ataque_extra_ranged',
    'Ataque extra',
    'ranged',
    '—',
    '—',
    '—',
    '—',
    '+1 ação de ataque corpo a corpo',
    '+2 ações (nv10+) · +3 (nv15+)',
    'Escala com nível de personagem',
  ),
  six(
    'talento_natural',
    'Talento natural',
    'ranged',
    '—',
    '—',
    '—',
    '—',
    '—',
    'Duas armas uma mão: +1 ataque · Ataque/Dano usam mod de Reflexos',
    'Nv6+',
  ),

  // — Corpo a Corpo —
  six(
    'golpe_pesado',
    'Golpe pesado',
    'melee',
    '+3 dano corpo a corpo',
    '+6',
    '+9',
    '+12',
    '+50',
    '+80',
  ),
  six(
    'ataque_precisao',
    'Ataque de precisão',
    'melee',
    '+3 acerto corpo a corpo',
    '+6',
    '+9',
    '+12',
    '+15',
    '+30',
  ),
  six(
    'limiar_morte',
    'Limiar da morte',
    'melee',
    'Margem de vida temporária ao chegar a 0 HP (baixa)',
    'Margem média',
    'Margem alta',
    'Margem muito alta',
    'Margem extrema',
    'Margem máxima até fim do combate',
  ),
  six(
    'forca_bruta',
    'Força bruta',
    'melee',
    '—',
    '—',
    '—',
    '—',
    '—',
    'Arma duas mãos: dobra mod de Força em ataque e dano',
    'Nv6+',
  ),
  six(
    'arremessar',
    'Arremessar',
    'melee',
    'Arremessar arma: dano ×2 · +4 acerto',
    '×3 · +8',
    '×4 · +12',
    '×5 · +16',
    '×8 · +20',
    '×12 · +25 (armas de arremesso + bónus)',
  ),
  six(
    'investida',
    'Investida',
    'melee',
    'Investida 20 m: 2d10 · empurra 3d10 m',
    '4d10',
    '6d10',
    'Dano repete se bater em obstáculo',
    'Prestígio',
    'Prestígio',
    'Prestígio',
  ),

  // — Mãos Nuas —
  six(
    'punhos_treinados',
    'Punhos treinados',
    'unarmed',
    '+4 dano mãos nuas',
    '+6',
    '+8',
    '+12',
    '+20',
    '+50 (prestígio)',
  ),
  six(
    'experiencia_combate',
    'Experiência de combate',
    'unarmed',
    '+2 ações de ataque (mãos nuas)',
    '+3',
    '+4',
    '+5',
    '+6',
    '+8',
  ),
  six(
    'golpe_certeiro',
    'Golpe certeiro',
    'unarmed',
    '+1 acerto mãos nuas',
    '+2',
    '+3',
    '+4',
    '+8',
    '+15',
  ),
  six(
    'frenesi_luta',
    'Frenesi da luta',
    'unarmed',
    '+2 iniciativa (mãos nuas)',
    '+4',
    '+6',
    '+8',
    '+12',
    '+20',
  ),
  six(
    'reflexos_apurados',
    'Reflexos apurados',
    'unarmed',
    '+5 CA (mãos nuas; ignora CA de equipamento)',
    '+7',
    '+9',
    '+11',
    '+13',
    '+15',
  ),
  six(
    'contra_ataque',
    'Contra-ataque',
    'unarmed',
    '—',
    '—',
    '—',
    '—',
    '—',
    'Ao desviar: contra-ataque garantido 1d4→3d6+½ Força',
    'Nv6',
  ),
  six(
    'adrenalina',
    'Adrenalina',
    'unarmed',
    '+1d4 vida temporária ao acertar (mãos nuas)',
    '+2d4',
    '+3d4',
    '+4d4',
    '+5d4',
    'Prestígio',
    'Prestígio',
  ),
  six(
    'insistente',
    'Insistente',
    'unarmed',
    '+2 testes de infecção',
    '+4',
    '+6',
    '+8',
    '+10',
    '+12',
    'Prestígio',
  ),
  six(
    'corpo_grande',
    'Corpo grande',
    'unarmed',
    '—',
    '—',
    '—',
    '—',
    '—',
    'Não pode ter membros arrancados ou amputados',
    'Nv6',
  ),

  // — Velocidade —
  six(
    'velocista',
    'Velocista',
    'speed',
    '+2 testes de corrida',
    '+4',
    '+6',
    '+8',
    '+12',
    '+20',
  ),
  six(
    'rapido_flecha',
    'Rápido como uma flecha',
    'speed',
    '+2 testes de reflexo',
    '+4',
    '+6',
    '+9',
    '+12',
    '+20',
  ),
  six(
    'maratonista',
    'Maratonista',
    'speed',
    '—',
    '—',
    '—',
    '—',
    '—',
    'Se falhar corrida: anda metade da distância',
    'Nv6',
  ),
  six(
    'mais_rapido_flecha',
    'Mais rápido que uma flecha',
    'speed',
    'Segundo dado ao falhar corrida/reflexo (+2)',
    '+4 mod extra',
    '+6',
    '+8',
    '+10',
    'Prestígio',
    'Prestígio',
  ),
  six(
    'multifuncional',
    'Multifuncional',
    'speed',
    '+1 ação extra (não ataque) por turno',
    '+2',
    '+3',
    '+4',
    '+5',
    '+8',
  ),

  // — Exploração —
  six(
    'explorador',
    'Explorador',
    'exploration',
    '+1 encontrar itens · crítico 19–20',
    '+2',
    '+3',
    '+4',
    '+5',
    '+10',
  ),
  six(
    'mais_uma_vez',
    'Mais uma vez!',
    'exploration',
    '—',
    '—',
    '—',
    '—',
    '—',
    'Explorar a mesma região duas vezes',
    'Nv6',
  ),
  six(
    'gatuno',
    'Gatuno',
    'exploration',
    'Explorar sem iluminação (parcial)',
    'Explorar sem luz (melhor)',
    'Explorar no escuro total',
    '—',
    '—',
    'Explorar cenários sem iluminar',
  ),
  six(
    'explorador_nato',
    'Explorador nato',
    'exploration',
    'Itens +1 tier de raridade',
    '+1 tier (melhor)',
    '+2 tiers',
    '—',
    '—',
    '+2 tiers (nv21+)',
    'Raridade acima do normal',
  ),

  // — Resistência —
  six(
    'resiliente',
    'Resiliente',
    'resistance',
    '+4 vida',
    '+8',
    '+12',
    '+20',
    '+40',
    '+80',
  ),
  six(
    'resistente',
    'Resistente',
    'resistance',
    '+2 CA',
    '+3',
    '+4',
    '+5',
    '+6',
    '+10',
  ),
  six(
    'persistente',
    'Persistente',
    'resistance',
    '+1d8 vida temporária',
    '+2d8',
    '+3d8',
    '+4d8',
    '+5d8',
    '+6d8',
  ),
];

export const TALENT_BY_ID: Record<TalentId, TalentDef> = Object.fromEntries(
  TALENTS.map((t) => [t.id, t]),
);

export const TALENT_CATEGORIES: TalentCategory[] = [
  'ranged',
  'melee',
  'unarmed',
  'speed',
  'exploration',
  'resistance',
];

export function getTalentDef(id: TalentId): TalentDef | undefined {
  return TALENT_BY_ID[id];
}

export function talentsInCategory(category: TalentCategory): TalentDef[] {
  return TALENTS.filter((t) => t.category === category);
}

/** Bónus activo no nível actual (1–6). */
export function talentBonusAtLevel(def: TalentDef, level: number): string {
  if (level <= 0) return '—';
  const idx = Math.min(level, def.maxLevel) - 1;
  return def.levelBonuses[idx] ?? '—';
}

/** HTML/texto completo para tooltip (todos os níveis). */
export function talentTooltipHtml(def: TalentDef, currentLevel: number): string {
  const lines = def.levelBonuses
    .map((b, i) => {
      const nv = i + 1;
      const active = currentLevel === nv;
      const style = active
        ? 'color:#7ee787;font-weight:700'
        : currentLevel > nv
          ? 'color:#8b949e;text-decoration:line-through'
          : 'color:#c9d1d9';
      return `<div style="${style}">Nv${nv}: ${b}</div>`;
    })
    .join('');
  const note = def.note
    ? `<div style="color:#ffe082;font-size:10px;margin-top:6px">${def.note}</div>`
    : '';
  const cat = TALENT_CATEGORY_LABELS[def.category];
  const cur =
    currentLevel > 0
      ? `<div style="margin:6px 0;padding:6px;background:rgba(35,134,54,0.15);border-radius:4px;font-size:11px"><strong>Nível actual (${currentLevel}):</strong> ${talentBonusAtLevel(def, currentLevel)}</div>`
      : '';
  return [
    `<div style="font-weight:800;font-size:13px;margin-bottom:4px">${def.name}</div>`,
    `<div style="font-size:10px;color:#8b949e;margin-bottom:6px">${cat}</div>`,
    cur,
    `<div style="font-size:10px;color:#8b949e;margin-bottom:4px">Habilidades iguais usam sempre o maior nível.</div>`,
    lines,
    note,
  ].join('');
}
