import { describe, expect, it } from 'vitest';
import {
  chooseRoadTile,
  dominantRoadType,
  markModeForCell,
  ROAD_TYPE_INDEX,
  ROAD_MARK_MODES,
} from '../../src/assets/smart';
import type { City, RoadSegment, RoadType } from '../../src/world/model/types';

function stubCity(
  roads: (RoadType | null)[][],
  segments: RoadSegment[] = [],
): City {
  const h = roads.length;
  const w = roads[0]!.length;
  const roadGrid = new Array<RoadType | null>(w * h).fill(null);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      roadGrid[y * w + x] = roads[y]![x] ?? null;
    }
  }
  return {
    id: 't',
    name: 't',
    seed: 1,
    profileId: 'HeuristicV1',
    sizeClass: 'small',
    tileSize: 12,
    grid: { w, h },
    center: { x: 1, y: 1 },
    bounds: { x: 0, y: 0, w, h },
    roadGrid,
    sidewalkGrid: new Array(w * h).fill(false),
    zoneGrid: new Array(w * h).fill('mixed'),
    densityGrid: new Array(w * h).fill('medium'),
    roads: segments,
    lots: [],
    structures: [],
    explorationPoints: [],
    ambientProps: [],
    narrativeSlots: [],
  };
}

describe('RoadSmartTile markings', () => {
  it('uses highway type even if grid cell was overwritten by street', () => {
    const grid: (RoadType | null)[][] = [
      ['street', 'street', 'street'],
      ['street', 'street', 'street'],
      ['street', 'street', 'street'],
    ];
    const segs: RoadSegment[] = [
      { id: 'hw', type: 'highway', rect: { x: 0, y: 0, w: 3, h: 3 } },
      { id: 'st', type: 'street', rect: { x: 1, y: 0, w: 1, h: 3 } },
    ];
    const city = stubCity(grid, segs);
    expect(dominantRoadType(city, 1, 1)).toBe('highway');
    const tile = chooseRoadTile(city, 1, 1)!;
    // yellow highway bank, not street white
    expect(tile.frame).toBeGreaterThanOrEqual(ROAD_TYPE_INDEX.highway * ROAD_MARK_MODES * 16);
    expect(tile.frame).toBeLessThan(ROAD_TYPE_INDEX.main * ROAD_MARK_MODES * 16);
  });

  it('centers marks on odd-width highway (mode 1)', () => {
    const grid: (RoadType | null)[][] = [
      ['highway', 'highway', 'highway'],
      ['highway', 'highway', 'highway'],
      ['highway', 'highway', 'highway'],
    ];
    const seg: RoadSegment = {
      id: 'r1',
      type: 'highway',
      rect: { x: 0, y: 0, w: 3, h: 3 },
    };
    const city = stubCity(grid, [seg]);
    expect(markModeForCell(city, 1, 1)).toBe(1);
    expect(markModeForCell(city, 0, 1)).toBe(0);
    expect(markModeForCell(city, 2, 1)).toBe(0);
  });

  it('uses center marks on odd-width avenue (thickness 3)', () => {
    const grid: (RoadType | null)[][] = [
      ['avenue', 'avenue', 'avenue'],
      ['avenue', 'avenue', 'avenue'],
      ['avenue', 'avenue', 'avenue'],
    ];
    const seg: RoadSegment = {
      id: 'a',
      type: 'avenue',
      rect: { x: 0, y: 0, w: 3, h: 3 },
    };
    const city = stubCity(grid, [seg]);
    expect(markModeForCell(city, 1, 1)).toBe(1);
    expect(markModeForCell(city, 0, 1)).toBe(0);
    expect(markModeForCell(city, 2, 1)).toBe(0);
  });

  it('offsets marks on even-width stub (legacy path)', () => {
    // thickness 2 vertical at x=0..1 — gerador actual usa só ímpares ×3
    const grid: (RoadType | null)[][] = [
      ['avenue', 'avenue'],
      ['avenue', 'avenue'],
      ['avenue', 'avenue'],
    ];
    const seg: RoadSegment = {
      id: 'a',
      type: 'avenue',
      rect: { x: 0, y: 0, w: 2, h: 3 },
    };
    const city = stubCity(grid, [seg]);
    expect(markModeForCell(city, 0, 1)).toBe(4);
    expect(markModeForCell(city, 1, 1)).toBe(0);
  });

  it('skips marks at real H+V intersection', () => {
    const grid: (RoadType | null)[][] = [
      [null, 'main', null],
      ['main', 'main', 'main'],
      [null, 'main', null],
    ];
    const segs: RoadSegment[] = [
      { id: 'v', type: 'main', rect: { x: 1, y: 0, w: 1, h: 3 } },
      { id: 'h', type: 'main', rect: { x: 0, y: 1, w: 3, h: 1 } },
    ];
    const city = stubCity(grid, segs);
    expect(markModeForCell(city, 1, 1)).toBe(0);
  });
});
