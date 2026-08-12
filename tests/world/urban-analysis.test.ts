import { describe, expect, it } from 'vitest';
import { _classifyHighwayForTest } from '../../tools/urban-analysis/src/metrics/roads';
import { getCityTarget, CITY_TARGETS } from '../../tools/urban-analysis/src/cities';
import { overpassToLayers } from '../../tools/urban-analysis/src/convert';
import { computeRoadMetrics } from '../../tools/urban-analysis/src/metrics/roads';

describe('urban-analysis cities', () => {
  it('has uberlandia target', () => {
    const c = getCityTarget('uberlandia');
    expect(c.bbox).toHaveLength(4);
    expect(CITY_TARGETS.uberlandia).toBeDefined();
  });
});

describe('road classification', () => {
  it('maps highway tags', () => {
    expect(_classifyHighwayForTest('primary')).toBe('primary');
    expect(_classifyHighwayForTest('primary_link')).toBe('primary');
    expect(_classifyHighwayForTest('living_street')).toBe('residential');
    expect(_classifyHighwayForTest('footway')).toBe('other');
  });
});

describe('overpass convert + road metrics (fixture)', () => {
  it('builds graph metrics from minimal ways', () => {
    const layers = overpassToLayers({
      elements: [
        {
          type: 'way',
          id: 1,
          tags: { highway: 'residential' },
          geometry: [
            { lat: -18.92, lon: -48.28 },
            { lat: -18.92, lon: -48.27 },
          ],
        },
        {
          type: 'way',
          id: 2,
          tags: { highway: 'primary' },
          geometry: [
            { lat: -18.92, lon: -48.28 },
            { lat: -18.91, lon: -48.28 },
          ],
        },
      ],
    });
    expect(layers.roads.features).toHaveLength(2);
    const m = computeRoadMetrics(layers.roads);
    expect(m.count).toBe(2);
    expect(m.graph.nodeCount).toBeGreaterThanOrEqual(3);
    // T shared endpoint: degrees 2,1,1 → deadEndRatio 2/3
    expect(m.graph.deadEndRatio).toBeCloseTo(2 / 3, 5);
    expect(m.meta.quality).toBe('insufficient'); // n < 50
  });

  it('detects mid-way T-junction via shared vertices', () => {
    // Horizontal A—B—C with vertical stub B—D (B is not an OSM way endpoint of the stub alone)
    const layers = overpassToLayers({
      elements: [
        {
          type: 'way',
          id: 10,
          tags: { highway: 'residential' },
          geometry: [
            { lat: -18.92, lon: -48.29 },
            { lat: -18.92, lon: -48.28 },
            { lat: -18.92, lon: -48.27 },
          ],
        },
        {
          type: 'way',
          id: 11,
          tags: { highway: 'residential' },
          geometry: [
            { lat: -18.92, lon: -48.28 },
            { lat: -18.91, lon: -48.28 },
          ],
        },
      ],
    });
    const m = computeRoadMetrics(layers.roads);
    expect(m.graph.nodeCount).toBe(4);
    expect(m.graph.edgeCount).toBe(3);
    // degrees: A1, B3, C1, D1 → deadEnds 3/4
    expect(m.graph.deadEndRatio).toBeCloseTo(0.75, 5);
    expect(m.graph.meanDegree).toBeCloseTo(1.5, 5);
  });
});

describe('osm-derived profiles', () => {
  it('registers BrazilianMediumCity after build:profiles', async () => {
    const { listProfiles, getProfile } = await import('../../src/world/profiles');
    const ids = listProfiles().map((p) => p.id);
    expect(ids).toContain('HeuristicV1');
    expect(ids).toContain('BrazilianMediumCity');
    expect(ids).toContain('UberlandiaObserved');
    const mid = getProfile('BrazilianMediumCity');
    expect(mid.origin).toBe('osm-derived');
    expect(mid.buildings.footprintArea.sampleSize).toBeGreaterThan(0);
  });
});

describe('block metrics', () => {
  it('estimates block faces from a simple street grid', async () => {
    const { computeBlockMetrics } = await import(
      '../../tools/urban-analysis/src/metrics/blocks'
    );
    const layers = overpassToLayers({
      elements: [
        {
          type: 'way',
          id: 1,
          tags: { highway: 'residential' },
          geometry: [
            { lat: -18.92, lon: -48.281 },
            { lat: -18.92, lon: -48.28 },
            { lat: -18.92, lon: -48.279 },
          ],
        },
        {
          type: 'way',
          id: 2,
          tags: { highway: 'residential' },
          geometry: [
            { lat: -18.921, lon: -48.279 },
            { lat: -18.92, lon: -48.279 },
            { lat: -18.919, lon: -48.279 },
          ],
        },
        {
          type: 'way',
          id: 3,
          tags: { highway: 'residential' },
          geometry: [
            { lat: -18.919, lon: -48.279 },
            { lat: -18.919, lon: -48.28 },
            { lat: -18.919, lon: -48.281 },
          ],
        },
        {
          type: 'way',
          id: 4,
          tags: { highway: 'residential' },
          geometry: [
            { lat: -18.919, lon: -48.281 },
            { lat: -18.92, lon: -48.281 },
            { lat: -18.921, lon: -48.281 },
          ],
        },
        {
          type: 'way',
          id: 5,
          tags: { highway: 'residential' },
          geometry: [
            { lat: -18.921, lon: -48.281 },
            { lat: -18.921, lon: -48.28 },
            { lat: -18.921, lon: -48.279 },
          ],
        },
      ],
    });
    const b = computeBlockMetrics(layers.roads);
    expect(b.faceLengthM.sampleSize).toBeGreaterThan(0);
    expect(b.meta.notes.some((n) => n.includes('street-graph'))).toBe(true);
  });
});
