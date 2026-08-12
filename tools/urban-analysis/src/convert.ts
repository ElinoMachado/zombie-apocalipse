import type {
  Feature,
  FeatureCollection,
  LineString,
  Point,
  Polygon,
  Position,
} from 'geojson';

export interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  tags?: Record<string, string>;
  lat?: number;
  lon?: number;
  geometry?: { lat: number; lon: number }[];
}

export interface OsmResponse {
  elements?: OsmElement[];
}

function ringFromGeom(geometry: { lat: number; lon: number }[]): Position[] {
  return geometry.map((g) => [g.lon, g.lat] as Position);
}

export function overpassToLayers(data: OsmResponse): {
  roads: FeatureCollection<LineString>;
  buildings: FeatureCollection<Polygon | Point>;
  amenities: FeatureCollection<Point | Polygon>;
  shops: FeatureCollection<Point | Polygon>;
  landuse: FeatureCollection<Polygon>;
  elementCount: number;
} {
  const roads: Feature<LineString>[] = [];
  const buildings: Feature<Polygon | Point>[] = [];
  const amenities: Feature<Point | Polygon>[] = [];
  const shops: Feature<Point | Polygon>[] = [];
  const landuse: Feature<Polygon>[] = [];

  const elements = data.elements ?? [];

  for (const el of elements) {
    const tags = el.tags ?? {};

    if (el.type === 'node' && el.lat != null && el.lon != null) {
      const point: Feature<Point> = {
        type: 'Feature',
        properties: { ...tags, osmId: el.id, osmType: 'node' },
        geometry: { type: 'Point', coordinates: [el.lon, el.lat] },
      };
      if (tags.amenity) amenities.push(point);
      if (tags.shop) shops.push(point);
      continue;
    }

    if (el.type === 'way' && el.geometry && el.geometry.length >= 2) {
      const coords = ringFromGeom(el.geometry);
      const closed =
        coords.length >= 4 &&
        coords[0]![0] === coords[coords.length - 1]![0] &&
        coords[0]![1] === coords[coords.length - 1]![1];

      if (tags.highway) {
        roads.push({
          type: 'Feature',
          properties: { ...tags, osmId: el.id, osmType: 'way' },
          geometry: { type: 'LineString', coordinates: coords },
        });
      }

      if (tags.building) {
        if (closed) {
          buildings.push({
            type: 'Feature',
            properties: { ...tags, osmId: el.id, osmType: 'way' },
            geometry: { type: 'Polygon', coordinates: [coords] },
          });
        } else {
          const mid = coords[Math.floor(coords.length / 2)]!;
          buildings.push({
            type: 'Feature',
            properties: { ...tags, osmId: el.id, osmType: 'way', incomplete: true },
            geometry: { type: 'Point', coordinates: mid },
          });
        }
      }

      if (tags.amenity) {
        if (closed) {
          amenities.push({
            type: 'Feature',
            properties: { ...tags, osmId: el.id, osmType: 'way' },
            geometry: { type: 'Polygon', coordinates: [coords] },
          });
        } else {
          const mid = coords[Math.floor(coords.length / 2)]!;
          amenities.push({
            type: 'Feature',
            properties: { ...tags, osmId: el.id, osmType: 'way' },
            geometry: { type: 'Point', coordinates: mid },
          });
        }
      }

      if (tags.shop) {
        if (closed) {
          shops.push({
            type: 'Feature',
            properties: { ...tags, osmId: el.id, osmType: 'way' },
            geometry: { type: 'Polygon', coordinates: [coords] },
          });
        } else {
          const mid = coords[Math.floor(coords.length / 2)]!;
          shops.push({
            type: 'Feature',
            properties: { ...tags, osmId: el.id, osmType: 'way' },
            geometry: { type: 'Point', coordinates: mid },
          });
        }
      }

      if (tags.landuse && closed) {
        landuse.push({
          type: 'Feature',
          properties: { ...tags, osmId: el.id, osmType: 'way' },
          geometry: { type: 'Polygon', coordinates: [coords] },
        });
      }
    }
  }

  const fc = <G extends GeoJSON.Geometry>(features: Feature<G>[]) =>
    ({ type: 'FeatureCollection', features }) as FeatureCollection<G>;

  return {
    roads: fc(roads),
    buildings: fc(buildings),
    amenities: fc(amenities),
    shops: fc(shops),
    landuse: fc(landuse),
    elementCount: elements.length,
  };
}
