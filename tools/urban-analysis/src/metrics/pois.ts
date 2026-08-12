import * as turf from '@turf/turf';
import type { Feature, FeatureCollection, LineString, Point, Polygon } from 'geojson';
import { fromSamples } from '../../../../src/world/stats/distribution';
import type { Distribution } from '../../../../src/world/stats/types';

const POI_GROUPS: Record<string, { keys: string[]; tag: 'amenity' | 'shop' }> = {
  hospital: { tag: 'amenity', keys: ['hospital'] },
  clinic: { tag: 'amenity', keys: ['clinic', 'doctors'] },
  pharmacy: { tag: 'amenity', keys: ['pharmacy'] },
  police: { tag: 'amenity', keys: ['police'] },
  fire_station: { tag: 'amenity', keys: ['fire_station'] },
  school: { tag: 'amenity', keys: ['school'] },
  university: { tag: 'amenity', keys: ['university', 'college'] },
  fuel: { tag: 'amenity', keys: ['fuel'] },
  parking: { tag: 'amenity', keys: ['parking'] },
  place_of_worship: { tag: 'amenity', keys: ['place_of_worship'] },
  supermarket: { tag: 'shop', keys: ['supermarket'] },
  convenience: { tag: 'shop', keys: ['convenience'] },
  restaurant: { tag: 'amenity', keys: ['restaurant', 'fast_food', 'cafe'] },
};

export interface PoiGroupMetrics {
  count: number;
  quality: 'observed' | 'insufficient';
  confidence: number;
  distanceToNearestMajorRoadM?: Distribution;
  notes: string[];
}

export interface PoiMetrics {
  meta: {
    amenityCount: number;
    shopCount: number;
    notes: string[];
  };
  groups: Record<string, PoiGroupMetrics>;
}

function featurePoint(f: Feature<Point | Polygon>): Feature<Point> {
  if (f.geometry.type === 'Point') return f as Feature<Point>;
  return turf.centroid(f);
}

function isMajorRoad(highway: string | undefined): boolean {
  if (!highway) return false;
  return [
    'motorway',
    'trunk',
    'primary',
    'secondary',
    'tertiary',
    'motorway_link',
    'trunk_link',
    'primary_link',
    'secondary_link',
  ].some((h) => highway === h || highway.startsWith(h));
}

export function computePoiMetrics(
  amenities: FeatureCollection<Point | Polygon>,
  shops: FeatureCollection<Point | Polygon>,
  roads: FeatureCollection<LineString>,
): PoiMetrics {
  const notes: string[] = [];
  const majorRoads = roads.features.filter((f) =>
    isMajorRoad(String(f.properties?.highway ?? '')),
  );

  if (majorRoads.length < 10) {
    notes.push('INSUFFICIENT DATA: few major roads for POI distance stats');
  }

  const allAmenity = amenities.features;
  const allShop = shops.features;
  const groups: Record<string, PoiGroupMetrics> = {};

  for (const [groupId, def] of Object.entries(POI_GROUPS)) {
    const pool = def.tag === 'amenity' ? allAmenity : allShop;
    const matched = pool.filter((f) => {
      const v = String(f.properties?.[def.tag] ?? '');
      return def.keys.includes(v);
    });

    const gNotes: string[] = [];
    const dists: number[] = [];

    if (matched.length === 0) {
      gNotes.push('INSUFFICIENT DATA: zero features tagged for this group');
    } else if (matched.length < 5) {
      gNotes.push(
        `INSUFFICIENT DATA: n=${matched.length} — distribution unreliable`,
      );
    }

    if (majorRoads.length >= 10 && matched.length > 0) {
      for (const f of matched) {
        const pt = featurePoint(f);
        let best = Infinity;
        for (const road of majorRoads) {
          try {
            const snapped = turf.nearestPointOnLine(road, pt, {
              units: 'meters',
            });
            const d = snapped.properties.dist ?? Infinity;
            if (d < best) best = d;
          } catch {
            /* skip bad geometry */
          }
        }
        if (Number.isFinite(best) && best < 5000) dists.push(best);
      }
    }

    const confidence =
      matched.length >= 15 && dists.length >= 10
        ? Math.min(1, matched.length / 40)
        : matched.length >= 5
          ? 0.25
          : 0;

    groups[groupId] = {
      count: matched.length,
      quality: matched.length >= 5 ? 'observed' : 'insufficient',
      confidence,
      distanceToNearestMajorRoadM:
        dists.length >= 5
          ? fromSamples(dists, {
              unit: 'm',
              confidence,
              notes: 'Distance to nearest major highway=* way',
            })
          : undefined,
      notes: gNotes,
    };
  }

  return {
    meta: {
      amenityCount: allAmenity.length,
      shopCount: allShop.length,
      notes,
    },
    groups,
  };
}
