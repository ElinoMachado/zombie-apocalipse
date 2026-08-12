import * as turf from '@turf/turf';
import type { FeatureCollection, Point, Polygon } from 'geojson';
import { fromSamples } from '../../../../src/world/stats/distribution';
import type { Distribution } from '../../../../src/world/stats/types';

export interface BuildingMetrics {
  meta: {
    quality: 'observed' | 'insufficient' | 'estimated';
    sampleSize: number;
    polygonCount: number;
    pointOnlyCount: number;
    confidence: number;
    notes: string[];
  };
  areaM2: Distribution;
  /** Estimated — OSM rarely has parcels in BR cities. */
  lots: {
    quality: 'estimated' | 'insufficient';
    notes: string;
  };
}

export function computeBuildingMetrics(
  buildings: FeatureCollection<Polygon | Point>,
): BuildingMetrics {
  const notes: string[] = [];
  const areas: number[] = [];
  let polygonCount = 0;
  let pointOnlyCount = 0;

  for (const f of buildings.features) {
    if (f.geometry.type === 'Polygon') {
      polygonCount += 1;
      const m2 = turf.area(f);
      if (m2 > 5 && m2 < 50_000) areas.push(m2);
    } else {
      pointOnlyCount += 1;
    }
  }

  if (polygonCount < 30) {
    notes.push('INSUFFICIENT DATA: few building polygons with geometry');
  }
  if (pointOnlyCount > 0) {
    notes.push(
      `${pointOnlyCount} buildings without closed polygon (counted but excluded from area)`,
    );
  }
  notes.push(
    'Lots: INSUFFICIENT DATA / estimated — Brazilian OSM rarely tags parcels; do not invent lot rules yet',
  );

  const confidence = Math.min(1, polygonCount / 800);

  return {
    meta: {
      quality: polygonCount >= 30 ? 'observed' : 'insufficient',
      sampleSize: buildings.features.length,
      polygonCount,
      pointOnlyCount,
      confidence,
      notes,
    },
    areaM2: fromSamples(areas, {
      unit: 'm²',
      confidence,
      notes: 'Building footprint areas from closed ways',
    }),
    lots: {
      quality: 'insufficient',
      notes:
        'INSUFFICIENT DATA: no reliable lot geometries; footprint≠lot. Marked estimated until better source.',
    },
  };
}
