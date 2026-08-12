import type { City, Region } from '../model/types';
import { Rng } from '../rng/Rng';
import { nextId } from './util';

/** Stub: uma região placeholder contendo a cidade. */
export function generateRegionStub(city: City, rng: Rng): Region {
  void rng;
  return {
    id: nextId('region'),
    biome: 'mixed',
    bounds: {
      x: 0,
      y: 0,
      w: city.grid.w,
      h: city.grid.h,
    },
    cities: [city],
    roads: [...city.roads],
    structures: [],
  };
}
