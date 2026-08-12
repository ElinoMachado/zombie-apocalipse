import type { CityMetricsReport } from './metrics/report';
import type { CityProfile, POIRule } from '../../../src/world/profiles/types';
import type { Distribution } from '../../../src/world/stats/types';
import type { RoadType } from '../../../src/world/model/types';
import { dist } from '../../../src/world/stats/distribution';
import { CITY_TARGETS } from './cities';

const METERS_PER_TILE = 12;

function mToTiles(d: Distribution): Distribution {
  return {
    ...d,
    mean: d.mean / METERS_PER_TILE,
    median: d.median / METERS_PER_TILE,
    stdDev: d.stdDev / METERS_PER_TILE,
    p10: d.p10 / METERS_PER_TILE,
    p25: d.p25 / METERS_PER_TILE,
    p50: d.p50 / METERS_PER_TILE,
    p75: d.p75 / METERS_PER_TILE,
    p90: d.p90 / METERS_PER_TILE,
    unit: 'tiles',
    notes: `${d.notes ?? ''} (converted m→tiles @ ${METERS_PER_TILE}m/tile)`.trim(),
  };
}

function m2ToTiles2(d: Distribution): Distribution {
  const f = METERS_PER_TILE * METERS_PER_TILE;
  return {
    ...d,
    mean: d.mean / f,
    median: d.median / f,
    stdDev: d.stdDev / f,
    p10: d.p10 / f,
    p25: d.p25 / f,
    p50: d.p50 / f,
    p75: d.p75 / f,
    p90: d.p90 / f,
    unit: 'tiles²',
    notes: `${d.notes ?? ''} (converted m²→tiles²)`.trim(),
  };
}

/** Map OSM highway classes → game RoadType weights (by length share). */
function hierarchyFromOsm(
  byClass: Record<string, { count: number; lengthKm: number }>,
): Partial<Record<RoadType, number>> {
  const len = (k: string) => byClass[k]?.lengthKm ?? 0;
  const highway = len('motorway') + len('trunk');
  const main = len('primary');
  const avenue = len('secondary') + len('tertiary');
  const street = len('residential') + len('unclassified');
  const residential = len('service') + len('other');
  const total = highway + main + avenue + street + residential || 1;
  const scale = (v: number) => Math.max(1, Math.round((v / total) * 40));
  return {
    highway: scale(highway),
    main: scale(main),
    avenue: scale(avenue),
    street: scale(street),
    residential: scale(residential),
  };
}

const POI_TO_STRUCTURE: Record<
  string,
  { structureId: string; zones: CityProfile['poiRules'][0]['preferredZones']; roads: RoadType[] }
> = {
  hospital: {
    structureId: 'hospital',
    zones: ['center', 'commercial', 'mixed', 'residential_med'],
    roads: ['avenue', 'main'],
  },
  clinic: {
    structureId: 'clinic',
    zones: ['commercial', 'mixed', 'residential_med', 'center'],
    roads: ['avenue', 'street', 'main'],
  },
  pharmacy: {
    structureId: 'pharmacy',
    zones: ['commercial', 'mixed', 'residential_med', 'center'],
    roads: ['street', 'avenue'],
  },
  police: {
    structureId: 'police',
    zones: ['center', 'commercial', 'mixed'],
    roads: ['avenue', 'main'],
  },
  fire_station: {
    structureId: 'fire_station',
    zones: ['mixed', 'industrial', 'commercial', 'center'],
    roads: ['avenue', 'main'],
  },
  school: {
    structureId: 'school',
    zones: ['residential_med', 'residential_low', 'mixed', 'suburban'],
    roads: ['avenue', 'street', 'main'],
  },
  fuel: {
    structureId: 'gas_station',
    zones: ['commercial', 'periphery', 'industrial', 'suburban', 'mixed'],
    roads: ['main', 'avenue', 'highway'],
  },
  supermarket: {
    structureId: 'market',
    zones: ['commercial', 'mixed', 'center', 'residential_med'],
    roads: ['avenue', 'street', 'main'],
  },
  place_of_worship: {
    structureId: 'church',
    zones: ['residential_low', 'residential_med', 'suburban', 'mixed'],
    roads: ['street', 'avenue'],
  },
};

function mergeDistributions(parts: Distribution[]): Distribution {
  if (parts.length === 0) {
    return dist({ p50: 0, confidence: 0, notes: 'INSUFFICIENT DATA' });
  }
  if (parts.length === 1) return parts[0]!;
  // Average percentiles (simple aggregate until proper pooled stats)
  const avg = (sel: (d: Distribution) => number) =>
    parts.reduce((s, d) => s + sel(d), 0) / parts.length;
  const sampleSize = parts.reduce((s, d) => s + d.sampleSize, 0);
  const confidence = Math.min(
    1,
    parts.reduce((s, d) => s + d.confidence, 0) / parts.length,
  );
  return {
    mean: avg((d) => d.mean),
    median: avg((d) => d.median),
    stdDev: avg((d) => d.stdDev),
    p10: avg((d) => d.p10),
    p25: avg((d) => d.p25),
    p50: avg((d) => d.p50),
    p75: avg((d) => d.p75),
    p90: avg((d) => d.p90),
    sampleSize,
    confidence,
    unit: parts[0]!.unit,
    notes: `Merged from ${parts.length} cities`,
  };
}

export function metricsToProfile(
  report: CityMetricsReport,
  opts?: { id?: string; label?: string },
): CityProfile {
  const target = CITY_TARGETS[report.cityId];
  const insufficient: CityProfile['insufficient'] = [];

  for (const flag of report.insufficientSummary) {
    insufficient.push({ key: flag, reason: `From OSM analysis: ${flag}` });
  }

  const blocksSrc = report.blocks;
  if (!blocksSrc || blocksSrc.meta.quality === 'insufficient') {
    insufficient.push({
      key: 'osm.blocks',
      reason: 'INSUFFICIENT DATA: block faces not extracted from road graph',
    });
  }

  const segTiles = mToTiles(report.roads.segmentLengthM);
  const footprint = m2ToTiles2(report.buildings.areaM2);
  const blockAreaTiles = blocksSrc
    ? m2ToTiles2(blocksSrc.areaM2)
    : dist({ p50: 80, p25: 50, p75: 120, confidence: 0, unit: 'tiles²' });

  const scaleDist = (d: Distribution, factor: number): Distribution => ({
    ...d,
    mean: d.mean * factor,
    median: d.median * factor,
    stdDev: d.stdDev * factor,
    p10: d.p10 * factor,
    p25: d.p25 * factor,
    p50: d.p50 * factor,
    p75: d.p75 * factor,
    p90: d.p90 * factor,
    notes: `${d.notes ?? ''} ×${factor} lot-from-block`.trim(),
  });

  const blockOk =
    !!blocksSrc &&
    blocksSrc.meta.quality !== 'insufficient' &&
    blocksSrc.meta.sampleSize >= 10;

  const poiRules: POIRule[] = [];
  for (const [groupId, mapping] of Object.entries(POI_TO_STRUCTURE)) {
    const g = report.pois.groups[groupId];
    if (!g) continue;
    const meta = {
      quality: g.quality === 'observed' ? ('observed' as const) : ('insufficient' as const),
      sampleSize: g.count,
      confidence: g.confidence,
      source: `OSM:${report.cityId}`,
      notes: g.notes.join('; ') || undefined,
    };
    poiRules.push({
      structureId: mapping.structureId,
      meta,
      preferredZones: mapping.zones,
      preferredRoadTypes: mapping.roads,
      minRoadAccess: 0.08,
      distanceToMajorRoad: g.distanceToNearestMajorRoadM
        ? mToTiles(g.distanceToNearestMajorRoadM)
        : undefined,
    });
  }

  // Scale subcenters / poles from amenity density (very rough)
  const amenityDensity = report.layers.amenities / Math.max(1, report.layers.roads);
  const poleBase = Math.max(2, Math.round(3 + amenityDensity * 20));

  return {
    id: opts?.id ?? `${pascal(report.cityId)}Observed`,
    label: opts?.label ?? `${report.label} (OSM-derived)`,
    version: 1,
    origin: 'osm-derived',
    description: `Derived from Overpass metrics of ${report.cityId} @ ${report.generatedAt}. Does not copy geometry.`,
    insufficient,
    roadNetwork: {
      meta: {
        quality: report.roads.meta.quality === 'observed' ? 'observed' : 'insufficient',
        sampleSize: report.roads.meta.sampleSize,
        confidence: report.roads.meta.confidence,
        source: `OSM:${report.cityId}`,
        notes: report.roads.meta.notes.join(' | '),
      },
      regularity: report.roads.regularityIndex,
      deadEndRatio: dist({
        p50: Math.min(0.4, Math.max(0.04, report.roads.graph.deadEndRatio)),
        p25: Math.min(
          0.3,
          Math.max(0.03, report.roads.graph.deadEndRatio * 0.75),
        ),
        p75: Math.min(0.5, report.roads.graph.deadEndRatio * 1.25),
        sampleSize: report.roads.graph.nodeCount,
        confidence: Math.min(0.7, report.roads.meta.confidence + 0.15),
        unit: 'ratio',
        notes: 'Shared-vertex road graph (snapped ~1.1m); no artificial downscale',
      }),
      intersectionDegree: {
        ...report.roads.graph.degreeDistribution,
        confidence: Math.min(0.7, report.roads.graph.degreeDistribution.confidence),
        notes: 'Shared-vertex undirected degree',
      },
      segmentLengthTiles: segTiles,
      hierarchyWeights: hierarchyFromOsm(report.roads.byClass),
    },
    blocks: blockOk
      ? {
          meta: {
            quality:
              blocksSrc!.meta.quality === 'observed' ? 'observed' : 'estimated',
            sampleSize: blocksSrc!.meta.sampleSize,
            confidence: blocksSrc!.meta.confidence,
            source: `OSM:${report.cityId}`,
            notes: blocksSrc!.meta.notes.join(' | '),
          },
          areaTiles: {
            ...blockAreaTiles,
            // Keep playable scale (coarse tile grid)
            p10: Math.max(20, Math.min(220, blockAreaTiles.p10)),
            p25: Math.max(28, Math.min(240, blockAreaTiles.p25)),
            p50: Math.max(36, Math.min(260, blockAreaTiles.p50)),
            p75: Math.max(48, Math.min(300, blockAreaTiles.p75)),
            p90: Math.max(60, Math.min(340, blockAreaTiles.p90)),
            mean: Math.max(36, Math.min(260, blockAreaTiles.mean)),
            median: Math.max(36, Math.min(260, blockAreaTiles.median)),
          },
          aspectRatio: {
            ...blocksSrc!.aspectRatio,
            p10: Math.max(0.7, Math.min(3, blocksSrc!.aspectRatio.p10)),
            p25: Math.max(0.8, Math.min(3, blocksSrc!.aspectRatio.p25)),
            p50: Math.max(0.9, Math.min(3, blocksSrc!.aspectRatio.p50)),
            p75: Math.max(1, Math.min(3.5, blocksSrc!.aspectRatio.p75)),
            p90: Math.max(1.1, Math.min(4, blocksSrc!.aspectRatio.p90)),
          },
        }
      : {
          meta: {
            quality: 'insufficient',
            sampleSize: 0,
            confidence: 0,
            notes: 'INSUFFICIENT DATA: blocks not extracted',
          },
          areaTiles: dist({
            p50: 80,
            p25: 50,
            p75: 120,
            confidence: 0,
            unit: 'tiles²',
            notes: 'placeholder until block detector',
          }),
          aspectRatio: dist({ p50: 1.25, p25: 1.0, p75: 1.7, confidence: 0 }),
        },
    lots: {
      meta: {
        quality: blockOk ? 'estimated' : 'estimated',
        sampleSize: blockOk ? blocksSrc!.meta.sampleSize : 0,
        confidence: blockOk ? Math.min(0.5, blocksSrc!.meta.confidence) : 0,
        notes: blockOk
          ? 'Lots estimated as fractions of street-graph block area (not cadastral)'
          : report.buildings.lots.notes,
      },
      areaByDensity: blockOk
        ? {
            high: scaleDist(blockAreaTiles, 0.55),
            medium: scaleDist(blockAreaTiles, 0.7),
            low: scaleDist(blockAreaTiles, 0.9),
            sparse: scaleDist(blockAreaTiles, 1.15),
          }
        : {
            high: dist({
              p50: 64,
              p25: 49,
              p75: 90,
              confidence: 0,
              unit: 'tiles²',
              notes: 'INSUFFICIENT DATA: parcel proxy (game-scale), not OSM footprint',
            }),
            medium: dist({
              p50: 80,
              p25: 56,
              p75: 110,
              confidence: 0,
              unit: 'tiles²',
              notes: 'INSUFFICIENT DATA: parcel proxy (game-scale), not OSM footprint',
            }),
            low: dist({
              p50: 100,
              p25: 72,
              p75: 140,
              confidence: 0,
              unit: 'tiles²',
              notes: 'INSUFFICIENT DATA: parcel proxy (game-scale), not OSM footprint',
            }),
            sparse: dist({
              p50: 140,
              p25: 100,
              p75: 200,
              confidence: 0,
              unit: 'tiles²',
              notes: 'INSUFFICIENT DATA: parcel proxy (game-scale), not OSM footprint',
            }),
          },
      emptyLotChanceByDensity: {
        high: 0.08,
        medium: 0.14,
        low: 0.28,
        sparse: 0.45,
      },
    },
    buildings: {
      meta: {
        quality: report.buildings.meta.quality === 'observed' ? 'observed' : 'insufficient',
        sampleSize: report.buildings.meta.polygonCount,
        confidence: report.buildings.meta.confidence,
        source: `OSM:${report.cityId}`,
        notes: report.buildings.meta.notes.join(' | '),
      },
      footprintArea: footprint,
    },
    density: {
      meta: {
        quality: 'estimated',
        sampleSize: report.layers.buildings,
        confidence: 0.3,
        notes: 'Radial breaks still heuristic; gradient from OSM TBD',
      },
      radialBreaks: [0.18, 0.38, 0.55],
      ruralEdgeBandFraction: target?.sizeHint === 'small' ? 0.18 : 0.12,
    },
    zones: {
      meta: {
        quality: 'estimated',
        sampleSize: report.layers.landuse,
        confidence: report.layers.landuse > 50 ? 0.3 : 0.1,
        notes: 'Zone bands still heuristic; landuse analysis TBD',
      },
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
        small: dist({ p50: Math.max(2, poleBase - 2), confidence: 0.2 }),
        medium: dist({ p50: poleBase, confidence: 0.2 }),
        large: dist({ p50: poleBase + 2, confidence: 0.2 }),
      },
    },
    centers: {
      meta: {
        quality: 'estimated',
        sampleSize: 0,
        confidence: 0.2,
        notes: 'Subcenter count estimated from amenity density',
      },
      centerRadiusNorm: dist({ p50: 0.16, p25: 0.12, p75: 0.2, confidence: 0.2 }),
      subcenterCount: dist({
        p50: poleBase,
        p25: Math.max(2, poleBase - 1),
        p75: poleBase + 2,
        confidence: 0.2,
      }),
    },
    transitions: {
      meta: {
        quality: 'heuristic',
        sampleSize: 0,
        confidence: 0,
      },
      smoothPasses: 1,
    },
    poiRules,
    dependencies: [
      { parentId: 'gas_station', childId: 'convenience', chance: 0.85, min: 0, max: 1 },
      { parentId: 'farm', childId: 'barn', chance: 0.9, min: 1, max: 1 },
      { parentId: 'hospital', childId: 'parking_lot', chance: 0.9, min: 1, max: 1 },
    ],
  };
}

export function mergeProfiles(
  profiles: CityProfile[],
  id: string,
  label: string,
): CityProfile {
  if (profiles.length === 0) {
    throw new Error('mergeProfiles: empty');
  }
  if (profiles.length === 1) {
    return { ...profiles[0]!, id, label, description: `${profiles[0]!.description} (aliased as ${id})` };
  }

  const base = profiles[0]!;
  const insufficient = [
    {
      key: 'cluster.sample',
      reason: `Merged from ${profiles.map((p) => p.id).join(', ')} — clustering still naive (mean of percentiles)`,
    },
  ];

  return {
    ...base,
    id,
    label,
    origin: 'osm-derived',
    description: `Naive merge of ${profiles.length} OSM-derived city profiles. Not a formal cluster yet.`,
    insufficient,
    roadNetwork: {
      ...base.roadNetwork,
      regularity:
        profiles.reduce((s, p) => s + p.roadNetwork.regularity, 0) / profiles.length,
      segmentLengthTiles: mergeDistributions(
        profiles.map((p) => p.roadNetwork.segmentLengthTiles),
      ),
      deadEndRatio: mergeDistributions(profiles.map((p) => p.roadNetwork.deadEndRatio)),
      intersectionDegree: mergeDistributions(
        profiles.map((p) => p.roadNetwork.intersectionDegree),
      ),
    },
    blocks: {
      ...base.blocks,
      meta: {
        ...base.blocks.meta,
        sampleSize: profiles.reduce((s, p) => s + p.blocks.meta.sampleSize, 0),
        confidence: Math.min(
          1,
          profiles.reduce((s, p) => s + p.blocks.meta.confidence, 0) / profiles.length,
        ),
        notes: `Merged block faces from ${profiles.length} cities`,
      },
      areaTiles: mergeDistributions(profiles.map((p) => p.blocks.areaTiles)),
      aspectRatio: mergeDistributions(profiles.map((p) => p.blocks.aspectRatio)),
    },
    lots: {
      ...base.lots,
      areaByDensity: {
        high: mergeDistributions(profiles.map((p) => p.lots.areaByDensity.high)),
        medium: mergeDistributions(profiles.map((p) => p.lots.areaByDensity.medium)),
        low: mergeDistributions(profiles.map((p) => p.lots.areaByDensity.low)),
        sparse: mergeDistributions(profiles.map((p) => p.lots.areaByDensity.sparse)),
      },
    },
    buildings: {
      ...base.buildings,
      footprintArea: mergeDistributions(profiles.map((p) => p.buildings.footprintArea)),
      meta: {
        ...base.buildings.meta,
        sampleSize: profiles.reduce((s, p) => s + p.buildings.meta.sampleSize, 0),
        confidence: Math.min(
          1,
          profiles.reduce((s, p) => s + p.buildings.meta.confidence, 0) / profiles.length,
        ),
        notes: `Merged footprints from ${profiles.length} cities`,
      },
    },
  };
}

function pascal(id: string): string {
  return id
    .split(/[_-]/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
}
