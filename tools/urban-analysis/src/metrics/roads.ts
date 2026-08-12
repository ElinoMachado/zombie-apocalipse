import * as turf from '@turf/turf';
import type { Feature, FeatureCollection, LineString } from 'geojson';
import { fromSamples } from '../../../../src/world/stats/distribution';
import type { Distribution } from '../../../../src/world/stats/types';

export type RoadClass =
  | 'motorway'
  | 'trunk'
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'residential'
  | 'service'
  | 'unclassified'
  | 'other';

export interface RoadMetrics {
  meta: {
    quality: 'observed' | 'insufficient';
    sampleSize: number;
    confidence: number;
    notes: string[];
  };
  totalLengthKm: number;
  count: number;
  byClass: Record<string, { count: number; lengthKm: number }>;
  segmentLengthM: Distribution;
  bearingDegrees: Distribution;
  /** 0 = orientations scattered; 1 = strong biaxial grid. Heuristic from bearing histogram. */
  regularityIndex: number;
  graph: {
    nodeCount: number;
    edgeCount: number;
    meanDegree: number;
    deadEndRatio: number;
    degreeDistribution: Distribution;
  };
}

function classifyHighway(tag: string | undefined): RoadClass {
  if (!tag) return 'other';
  if (
    tag === 'motorway' ||
    tag === 'motorway_link' ||
    tag === 'trunk' ||
    tag === 'trunk_link' ||
    tag === 'primary' ||
    tag === 'primary_link' ||
    tag === 'secondary' ||
    tag === 'secondary_link' ||
    tag === 'tertiary' ||
    tag === 'tertiary_link' ||
    tag === 'residential' ||
    tag === 'service' ||
    tag === 'unclassified'
  ) {
    if (tag.endsWith('_link')) {
      const base = tag.replace('_link', '') as RoadClass;
      return base;
    }
    return tag as RoadClass;
  }
  if (tag === 'living_street' || tag === 'pedestrian') return 'residential';
  return 'other';
}

/** ~1.1 m precision at equator — snap shared OSM vertices across ways. */
export function keyNode(lon: number, lat: number): string {
  return `${lon.toFixed(5)},${lat.toFixed(5)}`;
}

function regularityFromBearings(bearings: number[]): number {
  if (bearings.length < 20) return 0;
  const bins = new Array(9).fill(0) as number[];
  for (const b of bearings) {
    const folded = ((b % 180) + 180) % 180;
    const i = Math.min(8, Math.floor(folded / 20));
    bins[i]! += 1;
  }
  const total = bearings.length;
  const sorted = [...bins].sort((a, b) => b - a);
  const top2 = (sorted[0]! + sorted[1]!) / total;
  return Math.max(0, Math.min(1, (top2 - 0.22) / 0.45));
}

/**
 * Grafo undirected: todos os vértices da geometria (não só endpoints),
 * com snap espacial para partilhar cruzamentos entre ways OSM.
 */
export function buildSharedVertexGraph(
  roads: FeatureCollection<LineString>,
): {
  degree: Map<string, number>;
  edgeCount: number;
} {
  const degree = new Map<string, number>();
  const edges = new Set<string>();

  const bump = (k: string) => degree.set(k, (degree.get(k) ?? 0) + 1);

  for (const f of roads.features) {
    const coords = f.geometry.coordinates;
    if (coords.length < 2) continue;

    const keys: string[] = [];
    for (const c of coords) {
      const k = keyNode(c[0]!, c[1]!);
      if (keys.length === 0 || keys[keys.length - 1] !== k) keys.push(k);
    }
    if (keys.length < 2) continue;

    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i]!;
      const b = keys[i + 1]!;
      if (a === b) continue;
      const edgeKey = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (edges.has(edgeKey)) continue;
      edges.add(edgeKey);
      bump(a);
      bump(b);
    }
  }

  return { degree, edgeCount: edges.size };
}

export function computeRoadMetrics(
  roads: FeatureCollection<LineString>,
): RoadMetrics {
  const notes: string[] = [];
  const lengthsM: number[] = [];
  const bearings: number[] = [];
  const byClass: Record<string, { count: number; lengthKm: number }> = {};

  for (const f of roads.features) {
    const hw = String(f.properties?.highway ?? '');
    const klass = classifyHighway(hw);
    const lenKm = turf.length(f, { units: 'kilometers' });
    const lenM = lenKm * 1000;
    lengthsM.push(lenM);
    byClass[klass] ??= { count: 0, lengthKm: 0 };
    byClass[klass]!.count += 1;
    byClass[klass]!.lengthKm += lenKm;

    const coords = f.geometry.coordinates;
    if (coords.length >= 2) {
      for (let i = 0; i < coords.length - 1; i++) {
        const c0 = coords[i]!;
        const c1 = coords[i + 1]!;
        const seg = turf.lineString([c0, c1]);
        if (turf.length(seg, { units: 'meters' }) < 8) continue;
        const brng = turf.bearing(turf.point(c0), turf.point(c1));
        bearings.push((brng + 360) % 360);
      }
    }
  }

  const { degree, edgeCount } = buildSharedVertexGraph(roads);
  const degrees = [...degree.values()];
  const deadEnds = degrees.filter((d) => d === 1).length;
  const meanDegree =
    degrees.length === 0
      ? 0
      : degrees.reduce((s, d) => s + d, 0) / degrees.length;

  if (roads.features.length < 50) {
    notes.push('INSUFFICIENT DATA: few highway ways in bbox');
  }
  if (bearings.length < 50) {
    notes.push('INSUFFICIENT DATA: weak bearing sample for regularity');
  }
  notes.push(
    'Graph: shared-vertex topology (all geometry vertices, ~1.1m snap). Still misses true intersections where ways cross without a shared node.',
  );

  const confidence = Math.min(
    1,
    roads.features.length / 500 + (degrees.length > 100 ? 0.2 : 0),
  );

  const regularityIndex = regularityFromBearings(bearings);

  return {
    meta: {
      quality: roads.features.length >= 50 ? 'observed' : 'insufficient',
      sampleSize: roads.features.length,
      confidence,
      notes,
    },
    totalLengthKm: lengthsM.reduce((s, m) => s + m, 0) / 1000,
    count: roads.features.length,
    byClass,
    segmentLengthM: fromSamples(lengthsM, {
      unit: 'm',
      confidence,
      notes: 'OSM way lengths (not block face lengths)',
    }),
    bearingDegrees: fromSamples(bearings, {
      unit: 'deg',
      confidence: bearings.length >= 50 ? confidence : 0,
    }),
    regularityIndex,
    graph: {
      nodeCount: degree.size,
      edgeCount,
      meanDegree,
      deadEndRatio: degrees.length ? deadEnds / degrees.length : 0,
      degreeDistribution: fromSamples(degrees, {
        unit: 'degree',
        confidence: Math.min(0.7, confidence + 0.15),
        notes: 'Shared-vertex undirected degree',
      }),
    },
  };
}

/** Export for tests — classify helper */
export function _classifyHighwayForTest(tag: string): RoadClass {
  return classifyHighway(tag);
}

export type { Feature };
