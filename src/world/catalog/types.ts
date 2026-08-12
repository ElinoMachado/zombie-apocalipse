import type { Density, RoadType, ZoneType } from '../model/types';

export interface ScoreWeights {
  road: number;
  zone: number;
  density: number;
  lot: number;
  nearby: number;
  center: number;
  random: number;
}

export interface NearbyRule {
  structureId?: string;
  zone?: ZoneType;
  maxDistance: number;
  bonus?: number;
  penalty?: number;
}

export interface CompositionRule {
  childId: string;
  chance: number;
  min: number;
  max: number;
}

export interface StructureDefinition {
  id: string;
  label: string;
  category: 'primary' | 'secondary' | 'exploration';
  footprint: { w: number; h: number };
  color: number;
  allowedZones: ZoneType[];
  preferredRoadTypes: RoadType[];
  minRoadAccess: number;
  preferredDensity: Density[];
  rarity: number;
  maxPerCity?: number;
  lotSizeRange: { min: number; max: number };
  composition?: CompositionRule[];
  scoreWeights: ScoreWeights;
  requiredNearby?: NearbyRule[];
  forbiddenNearby?: NearbyRule[];
  /** Âncora de cidade (colocada antes do fill). */
  isCityAnchor?: boolean;
}

export const DEFAULT_WEIGHTS: ScoreWeights = {
  road: 1,
  zone: 1,
  density: 1,
  lot: 1,
  nearby: 1,
  center: 0.6,
  random: 0.35,
};

export const ZONE_LABELS: Record<ZoneType, string> = {
  center: 'Centro',
  commercial: 'Comercial',
  mixed: 'Mista',
  residential_med: 'Residencial médio',
  residential_low: 'Residencial baixo',
  suburban: 'Subúrbio',
  periphery: 'Periferia',
  industrial: 'Industrial',
  rural: 'Rural',
};

export const ZONE_TINTS: Record<ZoneType, number> = {
  center: 0x5c4030,
  commercial: 0x4a4520,
  mixed: 0x3d3528,
  residential_med: 0x244836,
  residential_low: 0x1e3a2e,
  suburban: 0x1a3228,
  periphery: 0x252820,
  industrial: 0x2a2840,
  rural: 0x1e2e1c,
};

export const ROAD_COLORS: Record<RoadType, number> = {
  highway: 0xd4d4d8,
  main: 0xa8a29e,
  avenue: 0x8b8b96,
  street: 0x5c5c66,
  residential: 0x45454f,
};

export const DENSITY_TO_ZONE: Density[] = ['high', 'medium', 'low', 'sparse'];

export const CITY_SIZE_DIMS = {
  // ×3 face às dims base (120×90 / …) para caber quadras com BLOCK_SCALE 6
  small: { w: 360, h: 270 },
  medium: { w: 600, h: 450 },
  large: { w: 840, h: 630 },
} as const;
