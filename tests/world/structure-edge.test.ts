import { describe, expect, it } from 'vitest';
import { generateWorld, getPrimaryCity } from '../../src/world';

describe('structure street frontage', () => {
  it('places most urban primaries near the street edge of the block', () => {
    const world = generateWorld({
      seed: 55,
      sizeClass: 'small',
      profileId: 'HeuristicV1',
    });
    const city = getPrimaryCity(world)!;
    const lotsById = new Map(city.lots.map((l) => [l.id, l]));
    const { w, h } = city.grid;

    let urban = 0;
    let nearStreet = 0;

    for (const s of city.structures) {
      if (s.category !== 'primary' || !s.lotId) continue;
      const lot = lotsById.get(s.lotId);
      if (!lot || lot.zone === 'rural') continue;
      urban += 1;

      // Perímetro do footprint a ≤2 tiles de via/calçada
      let close = false;
      outer: for (let y = s.bounds.y; y < s.bounds.y + s.bounds.h; y++) {
        for (const x of [s.bounds.x, s.bounds.x + s.bounds.w - 1]) {
          for (let dy = -2; dy <= 2 && !close; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
              const i = ny * w + nx;
              if (city.roadGrid[i] || city.sidewalkGrid[i]) {
                close = true;
                break outer;
              }
            }
          }
        }
      }
      if (!close) {
        for (let x = s.bounds.x; x < s.bounds.x + s.bounds.w; x++) {
          for (const y of [s.bounds.y, s.bounds.y + s.bounds.h - 1]) {
            for (let dy = -2; dy <= 2 && !close; dy++) {
              for (let dx = -2; dx <= 2; dx++) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                const i = ny * w + nx;
                if (city.roadGrid[i] || city.sidewalkGrid[i]) {
                  close = true;
                }
              }
            }
          }
        }
      }
      if (close) nearStreet += 1;
    }

    expect(urban).toBeGreaterThan(10);
    expect(nearStreet / urban).toBeGreaterThanOrEqual(0.6);
  });
});
