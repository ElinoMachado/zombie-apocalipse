import { dist } from '../stats/distribution';
import type { CityProfile } from './types';

const heuristicMeta = {
  quality: 'heuristic' as const,
  sampleSize: 0,
  confidence: 0,
  source: 'src/world pipeline v1 (pre-OSM)',
  notes: 'Placeholder mirroring current generator behavior — not OSM-derived',
};

/**
 * Profile que documenta o comportamento atual do gerador.
 * Será substituído/calibrado por profiles derivados de OSM.
 */
export const HeuristicV1: CityProfile = {
  id: 'HeuristicV1',
  label: 'Heurística v1 (pré-OSM)',
  version: 1,
  origin: 'heuristic',
  description:
    'Espelha o gerador ortogonal atual: grelha irregular, polos de bairro, orla rural. Sem calibração OSM.',
  insufficient: [
    {
      key: 'osm.roads',
      reason: 'INSUFFICIENT DATA: no OSM road metrics ingested yet',
    },
    {
      key: 'osm.blocks',
      reason: 'INSUFFICIENT DATA: block distributions not observed',
    },
    {
      key: 'osm.pois',
      reason: 'INSUFFICIENT DATA: POI spatial relations not measured',
    },
  ],
  roadNetwork: {
    meta: heuristicMeta,
    regularity: 0.75,
    deadEndRatio: dist({
      p50: 0.12,
      p25: 0.08,
      p75: 0.18,
      unit: 'ratio',
      confidence: 0,
    }),
    intersectionDegree: dist({
      p50: 3.2,
      p25: 2.5,
      p75: 3.8,
      unit: 'degree',
      confidence: 0,
    }),
    segmentLengthTiles: dist({
      p50: 12,
      p25: 8,
      p75: 18,
      unit: 'tiles',
      confidence: 0,
    }),
    hierarchyWeights: {
      highway: 3,
      main: 4,
      avenue: 5,
      street: 8,
      residential: 6,
    },
  },
  blocks: {
    meta: {
      ...heuristicMeta,
      notes: 'Blocks not yet a first-class primitive; lots approximate parcels',
    },
    areaTiles: dist({ p50: 80, p25: 50, p75: 120, unit: 'tiles²', confidence: 0 }),
    aspectRatio: dist({ p50: 1.2, p25: 1.0, p75: 1.6, confidence: 0 }),
  },
  lots: {
    meta: heuristicMeta,
    areaByDensity: {
      high: dist({ p50: 64, p25: 49, p75: 90, unit: 'tiles²', confidence: 0 }),
      medium: dist({ p50: 80, p25: 56, p75: 110, unit: 'tiles²', confidence: 0 }),
      low: dist({ p50: 100, p25: 72, p75: 140, unit: 'tiles²', confidence: 0 }),
      sparse: dist({ p50: 140, p25: 100, p75: 200, unit: 'tiles²', confidence: 0 }),
    },
    emptyLotChanceByDensity: {
      high: 0.08,
      medium: 0.14,
      low: 0.28,
      sparse: 0.45,
    },
  },
  buildings: {
    meta: heuristicMeta,
    footprintArea: dist({
      p50: 20,
      p25: 12,
      p75: 40,
      unit: 'tiles²',
      confidence: 0,
    }),
  },
  density: {
    meta: heuristicMeta,
    radialBreaks: [0.18, 0.38, 0.55],
    ruralEdgeBandFraction: 0.12,
  },
  zones: {
    meta: heuristicMeta,
    bands: [
      { zone: 'center', weight: 1 },
      { zone: 'commercial', weight: 1.2 },
      { zone: 'mixed', weight: 1 },
      { zone: 'residential_med', weight: 1.4 },
      { zone: 'residential_low', weight: 1.2 },
      { zone: 'suburban', weight: 0.9 },
      { zone: 'periphery', weight: 0.8 },
      { zone: 'industrial', weight: 0.7 },
      { zone: 'rural', weight: 1.1 },
    ],
    neighborhoodPolesBySize: {
      small: dist({ p50: 2, p25: 2, p75: 3, confidence: 0 }),
      medium: dist({ p50: 4, p25: 3, p75: 5, confidence: 0 }),
      large: dist({ p50: 6, p25: 5, p75: 7, confidence: 0 }),
    },
  },
  centers: {
    meta: heuristicMeta,
    centerRadiusNorm: dist({ p50: 0.16, p25: 0.12, p75: 0.2, confidence: 0 }),
    subcenterCount: dist({ p50: 4, p25: 3, p75: 5, confidence: 0 }),
  },
  transitions: {
    meta: heuristicMeta,
    smoothPasses: 1,
  },
  poiRules: [
    {
      structureId: 'hospital',
      meta: heuristicMeta,
      preferredZones: ['center', 'commercial', 'mixed', 'residential_med'],
      preferredRoadTypes: ['avenue', 'main'],
      minRoadAccess: 0.1,
      maxPerCityBySize: { small: 0, medium: 1, large: 2 },
    },
    {
      structureId: 'school',
      meta: heuristicMeta,
      preferredZones: ['residential_med', 'residential_low', 'mixed', 'suburban'],
      preferredRoadTypes: ['avenue', 'street', 'main'],
      minRoadAccess: 0.12,
      maxPerCityBySize: { small: 1, medium: 2, large: 3 },
    },
    {
      structureId: 'gas_station',
      meta: heuristicMeta,
      preferredZones: ['commercial', 'periphery', 'industrial', 'suburban', 'mixed'],
      preferredRoadTypes: ['main', 'avenue', 'highway'],
      minRoadAccess: 0.2,
      maxPerCityBySize: { small: 1, medium: 2, large: 3 },
    },
    {
      structureId: 'farm',
      meta: heuristicMeta,
      preferredZones: ['rural'],
      preferredRoadTypes: ['residential', 'street', 'main'],
      minRoadAccess: 0.05,
      maxPerCityBySize: { small: 1, medium: 2, large: 3 },
    },
  ],
  dependencies: [
    { parentId: 'gas_station', childId: 'convenience', chance: 0.85, min: 0, max: 1 },
    { parentId: 'farm', childId: 'barn', chance: 0.9, min: 1, max: 1 },
    { parentId: 'farm', childId: 'silo', chance: 0.7, min: 0, max: 2 },
    { parentId: 'hospital', childId: 'parking_lot', chance: 0.9, min: 1, max: 1 },
  ],
};
