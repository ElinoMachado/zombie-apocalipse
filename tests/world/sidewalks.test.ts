import { describe, expect, it } from 'vitest';
import { chooseSidewalkTile } from '../../src/assets/smart';
import { generateWorld, getPrimaryCity } from '../../src/world';
import {
  BLOCK_SCALE,
  ROAD_THICKNESS,
  roadThickness,
} from '../../src/world/pipeline/RoadGenerator';
import { SIDEWALK_WIDTH } from '../../src/world/pipeline/SidewalkGenerator';

describe('road thickness (odd ×3)', () => {
  it('keeps all base thicknesses odd multiples of 3', () => {
    for (const t of Object.values(ROAD_THICKNESS)) {
      expect(t % 2).toBe(1);
      expect(t % 3).toBe(0);
    }
  });

  it('widens highway on medium/large', () => {
    expect(roadThickness('highway', 'small')).toBe(3);
    expect(roadThickness('highway', 'medium')).toBe(9);
    expect(roadThickness('main', 'medium')).toBe(3);
  });
});

describe('urban road trim', () => {
  it('keeps only highways outside the urban footprint', () => {
    const world = generateWorld({
      seed: 99,
      sizeClass: 'small',
      profileId: 'HeuristicV1',
    });
    const city = getPrimaryCity(world)!;
    const { w, h } = city.grid;
    let ruralHighway = 0;
    let ruralOther = 0;
    for (let i = 0; i < w * h; i++) {
      if (city.zoneGrid[i] !== 'rural') continue;
      const r = city.roadGrid[i];
      if (!r) continue;
      if (r === 'highway') ruralHighway += 1;
      else ruralOther += 1;
    }
    expect(ruralHighway).toBeGreaterThan(0);
    expect(ruralOther).toBe(0);
  });

  it('does not place sidewalks in rural', () => {
    const world = generateWorld({
      seed: 99,
      sizeClass: 'small',
      profileId: 'HeuristicV1',
    });
    const city = getPrimaryCity(world)!;
    for (let i = 0; i < city.sidewalkGrid.length; i++) {
      if (city.sidewalkGrid[i]) {
        expect(city.zoneGrid[i]).not.toBe('rural');
      }
    }
  });

  it('keeps urban block interiors free of rural mix at the edge', () => {
    const world = generateWorld({
      seed: 11,
      sizeClass: 'small',
      profileId: 'HeuristicV1',
    });
    const city = getPrimaryCity(world)!;
    const { w, h } = city.grid;
    // Célula de calçada ou lote encostado a rua urbana não pode ser rural
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (!city.sidewalkGrid[i]) continue;
        expect(city.zoneGrid[i]).not.toBe('rural');
      }
    }
  });
});

describe('block scale', () => {
  it('uses BLOCK_SCALE 6 (quadras ×3; mapa cresce a par)', () => {
    expect(BLOCK_SCALE).toBe(6);
  });
});

describe('sidewalks around blocks', () => {
  it('uses half-width sidewalk (1 tile)', () => {
    expect(SIDEWALK_WIDTH).toBe(1);
  });

  it('rings roads without overlapping asphalt', () => {
    const world = generateWorld({
      seed: 42,
      sizeClass: 'small',
      profileId: 'HeuristicV1',
    });
    const city = getPrimaryCity(world)!;
    expect(city.sidewalkGrid.length).toBe(city.grid.w * city.grid.h);

    let sidewalks = 0;
    let overlapRoad = 0;
    const { w, h } = city.grid;
    for (let i = 0; i < w * h; i++) {
      if (!city.sidewalkGrid[i]) continue;
      sidewalks += 1;
      if (city.roadGrid[i]) overlapRoad += 1;
    }
    expect(sidewalks).toBeGreaterThan(40);
    expect(overlapRoad).toBe(0);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!city.sidewalkGrid[i]) continue;
        let near = false;
        for (let dy = -SIDEWALK_WIDTH; dy <= SIDEWALK_WIDTH && !near; dy++) {
          for (let dx = -SIDEWALK_WIDTH; dx <= SIDEWALK_WIDTH && !near; dx++) {
            if (Math.abs(dx) + Math.abs(dy) > SIDEWALK_WIDTH) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            if (city.roadGrid[ny * w + nx]) near = true;
          }
        }
        expect(near).toBe(true);
      }
    }
  });

  it('chooses a sidewalk tile frame for sidewalk cells', () => {
    const world = generateWorld({
      seed: 7,
      sizeClass: 'small',
      profileId: 'HeuristicV1',
    });
    const city = getPrimaryCity(world)!;
    const { w, h } = city.grid;
    let found = false;
    for (let y = 0; y < h && !found; y++) {
      for (let x = 0; x < w && !found; x++) {
        const tile = chooseSidewalkTile(city, x, y);
        if (!tile) continue;
        expect(tile.frame).toBeGreaterThanOrEqual(0);
        expect(tile.frame).toBeLessThan(16);
        found = true;
      }
    }
    expect(found).toBe(true);
  });
});
