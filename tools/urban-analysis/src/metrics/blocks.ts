import * as turf from '@turf/turf';
import type { FeatureCollection, LineString } from 'geojson';
import { fromSamples } from '../../../../src/world/stats/distribution';
import type { Distribution } from '../../../../src/world/stats/types';
import { keyNode } from './roads';

export interface BlockMetrics {
  meta: {
    quality: 'observed' | 'insufficient' | 'estimated';
    sampleSize: number;
    confidence: number;
    notes: string[];
  };
  /** Comprimento de face (entre interseções) em metros. */
  faceLengthM: Distribution;
  /** Área aproximada face_i × face_{i+1} nos cantos (m²). */
  areaM2: Distribution;
  /** Razão max/min das duas faces do canto. */
  aspectRatio: Distribution;
}

type Adj = { to: string; lengthM: number; bearing: number };

function buildAdjacency(
  roads: FeatureCollection<LineString>,
): Map<string, Adj[]> {
  const adj = new Map<string, Adj[]>();
  const edgeSet = new Set<string>();

  const add = (a: string, b: string, lengthM: number, bearing: number) => {
    if (a === b) return;
    const ek = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (edgeSet.has(ek)) return;
    edgeSet.add(ek);
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a)!.push({ to: b, lengthM, bearing });
    adj.get(b)!.push({
      to: a,
      lengthM,
      bearing: (bearing + 180) % 360,
    });
  };

  for (const f of roads.features) {
    const coords = f.geometry.coordinates;
    if (coords.length < 2) continue;
    for (let i = 0; i < coords.length - 1; i++) {
      const c0 = coords[i]!;
      const c1 = coords[i + 1]!;
      const a = keyNode(c0[0]!, c0[1]!);
      const b = keyNode(c1[0]!, c1[1]!);
      if (a === b) continue;
      const lengthM = turf.distance(turf.point(c0), turf.point(c1), {
        units: 'meters',
      });
      if (lengthM < 0.5) continue;
      const bearing = (turf.bearing(turf.point(c0), turf.point(c1)) + 360) % 360;
      add(a, b, lengthM, bearing);
    }
  }

  return adj;
}

/**
 * Faces de quarteirão ≈ caminhos entre nós de grau ≠ 2
 * (interseções e dead-ends). Áreas aproximadas pelos produtos
 * de faces consecutivas ordenadas por bearing no canto.
 */
export function computeBlockMetrics(
  roads: FeatureCollection<LineString>,
): BlockMetrics {
  const notes: string[] = [];
  const adj = buildAdjacency(roads);

  const degree = (k: string) => adj.get(k)?.length ?? 0;
  const isJunction = (k: string) => degree(k) !== 2;

  const faceLengths: number[] = [];
  const walked = new Set<string>();

  for (const [start, neighbors] of adj) {
    if (!isJunction(start)) continue;
    for (const first of neighbors) {
      const walkKey = `${start}>${first.to}`;
      if (walked.has(walkKey)) continue;

      let prev = start;
      let cur = first.to;
      let length = first.lengthM;
      let guard = 0;
      while (!isJunction(cur) && guard < 500) {
        guard += 1;
        const opts = adj.get(cur) ?? [];
        const next = opts.find((o) => o.to !== prev);
        if (!next) break;
        walked.add(`${prev}>${cur}`);
        length += next.lengthM;
        prev = cur;
        cur = next.to;
      }
      walked.add(`${prev}>${cur}`);
      walked.add(`${cur}>${prev}`);

      if (length >= 15 && length <= 800) {
        faceLengths.push(length);
      }
    }
  }

  const areas: number[] = [];
  const aspects: number[] = [];

  for (const [node, neighbors] of adj) {
    if (degree(node) < 3) continue;
    const ordered = [...neighbors].sort((a, b) => a.bearing - b.bearing);

    const faceFrom = (n: Adj): number | null => {
      let prev = node;
      let cur = n.to;
      let length = n.lengthM;
      let guard = 0;
      while (!isJunction(cur) && guard < 500) {
        guard += 1;
        const opts = adj.get(cur) ?? [];
        const next = opts.find((o) => o.to !== prev);
        if (!next) return length;
        length += next.lengthM;
        prev = cur;
        cur = next.to;
      }
      if (length < 15 || length > 800) return null;
      return length;
    };

    const faces = ordered
      .map(faceFrom)
      .filter((x): x is number => x != null);
    for (let i = 0; i < faces.length; i++) {
      const a = faces[i]!;
      const b = faces[(i + 1) % faces.length]!;
      if (faces.length < 2) break;
      const area = a * b;
      if (area >= 200 && area <= 250_000) {
        areas.push(area);
        aspects.push(Math.max(a, b) / Math.max(1, Math.min(a, b)));
      }
    }
  }

  if (faceLengths.length < 30) {
    notes.push('INSUFFICIENT DATA: few block faces extracted from road graph');
  }
  notes.push(
    'Blocks ESTIMATED from street-graph faces (intersection-to-intersection); not cadastral parcels.',
  );

  const quality: BlockMetrics['meta']['quality'] =
    areas.length >= 40
      ? 'observed'
      : areas.length >= 10
        ? 'estimated'
        : 'insufficient';

  const confidence =
    quality === 'observed'
      ? Math.min(0.75, areas.length / 200)
      : quality === 'estimated'
        ? 0.35
        : 0;

  return {
    meta: {
      quality,
      sampleSize: areas.length,
      confidence,
      notes,
    },
    faceLengthM: fromSamples(faceLengths, {
      unit: 'm',
      confidence,
      notes: 'Intersection-to-intersection face length',
    }),
    areaM2: fromSamples(areas, {
      unit: 'm²',
      confidence,
      notes: 'Corner product approximation face_i × face_{i+1}',
    }),
    aspectRatio: fromSamples(aspects, {
      confidence,
      notes: 'max/min of consecutive faces at junction',
    }),
  };
}
