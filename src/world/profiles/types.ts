import type { CitySizeClass, Density, RoadType, ZoneType } from '../model/types';
import type { Distribution, InsufficientFlag, MetricMeta } from '../stats/types';

export interface RoadNetworkProfile {
  meta: MetricMeta;
  /** Regularidade 0 (orgânica) – 1 (grelha). Heurística atual ≈ 0.75. */
  regularity: number;
  deadEndRatio: Distribution;
  intersectionDegree: Distribution;
  segmentLengthTiles: Distribution;
  hierarchyWeights: Partial<Record<RoadType, number>>;
}

export interface BlockProfile {
  meta: MetricMeta;
  areaTiles: Distribution;
  aspectRatio: Distribution;
}

export interface LotProfile {
  meta: MetricMeta;
  areaByDensity: Record<Density, Distribution>;
  emptyLotChanceByDensity: Record<Density, number>;
}

export interface BuildingProfile {
  meta: MetricMeta;
  /** Footprints tipicos em tiles² (placeholder). */
  footprintArea: Distribution;
}

export interface DensityProfile {
  meta: MetricMeta;
  /** Limiares de distNorm para high/medium/low/sparse. */
  radialBreaks: [number, number, number];
  ruralEdgeBandFraction: number;
}

export interface ZoneBandProfile {
  zone: ZoneType;
  /** Preferência relativa no anel / contexto (pesos). */
  weight: number;
}

export interface ZoneProfile {
  meta: MetricMeta;
  bands: ZoneBandProfile[];
  /** Nº típico de polos comerciais de bairro por sizeClass. */
  neighborhoodPolesBySize: Record<CitySizeClass, Distribution>;
}

export interface UrbanCenterProfile {
  meta: MetricMeta;
  /** Fração tipica da área como "center". */
  centerRadiusNorm: Distribution;
  subcenterCount: Distribution;
}

export interface TransitionProfile {
  meta: MetricMeta;
  /** Suavização / majority filter passes. */
  smoothPasses: number;
}

export interface POIRule {
  structureId: string;
  meta: MetricMeta;
  preferredZones: ZoneType[];
  preferredRoadTypes: RoadType[];
  minRoadAccess: number;
  maxPerCityBySize?: Partial<Record<CitySizeClass, number>>;
  /** Distâncias em tiles — placeholders até OSM. */
  distanceToMajorRoad?: Distribution;
  distanceToCenterNorm?: Distribution;
}

export interface StructureDependency {
  parentId: string;
  childId: string;
  chance: number;
  min: number;
  max: number;
}

export interface CityProfile {
  id: string;
  label: string;
  version: number;
  /** heuristic | derived-from-osm */
  origin: 'heuristic' | 'osm-derived';
  description: string;
  insufficient: InsufficientFlag[];
  roadNetwork: RoadNetworkProfile;
  blocks: BlockProfile;
  lots: LotProfile;
  buildings: BuildingProfile;
  density: DensityProfile;
  zones: ZoneProfile;
  centers: UrbanCenterProfile;
  transitions: TransitionProfile;
  poiRules: POIRule[];
  dependencies: StructureDependency[];
}
