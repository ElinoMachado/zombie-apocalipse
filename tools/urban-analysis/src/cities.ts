/** Catálogo de cidades-alvo para análise OSM (núcleo urbano, não município inteiro). */

export interface CityTarget {
  id: string;
  label: string;
  /** Overpass bbox: south, west, north, east (WGS84). */
  bbox: [number, number, number, number];
  /** small | medium | large — classificação preliminar para agregação. */
  sizeHint: 'small' | 'medium' | 'large';
  notes: string;
}

/**
 * Bboxes focados na mancha urbana aproximada.
 */
export const CITY_TARGETS: Record<string, CityTarget> = {
  uberlandia: {
    id: 'uberlandia',
    label: 'Uberlândia (núcleo urbano)',
    bbox: [-18.98, -48.36, -18.86, -48.2],
    sizeHint: 'medium',
    notes: 'MG — primeira cidade da Fase 3',
  },
  goiania: {
    id: 'goiania',
    label: 'Goiânia (núcleo)',
    bbox: [-16.73, -49.33, -16.63, -49.22],
    sizeHint: 'large',
    notes: 'GO — planejada / axial',
  },
  campinas: {
    id: 'campinas',
    label: 'Campinas (núcleo)',
    bbox: [-22.95, -47.1, -22.86, -47.0],
    sizeHint: 'large',
    notes: 'SP',
  },
  belo_horizonte: {
    id: 'belo_horizonte',
    label: 'Belo Horizonte (hipercentro)',
    bbox: [-19.935, -43.95, -19.91, -43.925],
    sizeHint: 'large',
    notes: 'MG — bbox reduzido para Overpass estável',
  },
  ituiutaba: {
    id: 'ituiutaba',
    label: 'Ituiutaba (núcleo)',
    bbox: [-19.02, -49.5, -18.94, -49.42],
    sizeHint: 'small',
    notes: 'MG — cidade menor para contraste',
  },
};

export function getCityTarget(id: string): CityTarget {
  const c = CITY_TARGETS[id];
  if (!c) {
    throw new Error(
      `Cidade desconhecida: ${id}. Disponíveis: ${Object.keys(CITY_TARGETS).join(', ')}`,
    );
  }
  return c;
}

export function listCityIds(): string[] {
  return Object.keys(CITY_TARGETS);
}
