import { CITY_SIZE_DIMS } from '../catalog/types';
import type { City, CitySizeClass, Density, RoadType, ZoneType } from '../model/types';
import { Rng } from '../rng/Rng';
import { nextId, resetIds } from './util';

const CITY_NAMES_A = [
  'Nova',
  'Porto',
  'Vila',
  'Campo',
  'Santa',
  'São',
  'Monte',
  'Rio',
  'Alto',
  'Baixa',
];
const CITY_NAMES_B = [
  'Cinza',
  'Quebrada',
  'Silêncio',
  'Ruínas',
  'Esperança',
  'Poeira',
  'Ferro',
  'Névoa',
  'Limo',
  'Cinzas',
];

export function createCityShell(
  seed: number,
  sizeClass: CitySizeClass,
  tileSize: number,
  rng: Rng,
  profileId: string,
): City {
  resetIds();
  const dims = CITY_SIZE_DIMS[sizeClass];
  const w = dims.w;
  const h = dims.h;
  const center = {
    x: Math.floor(w / 2) + rng.int(-4, 4),
    y: Math.floor(h / 2) + rng.int(-3, 3),
  };

  const roadGrid: (RoadType | null)[] = Array(w * h).fill(null);
  const sidewalkGrid: boolean[] = Array(w * h).fill(false);
  const zoneGrid: ZoneType[] = Array(w * h).fill('rural');
  const densityGrid: Density[] = Array(w * h).fill('sparse');

  return {
    id: nextId('city'),
    name: `${rng.pick(CITY_NAMES_A)} ${rng.pick(CITY_NAMES_B)}`,
    seed,
    sizeClass,
    tileSize,
    profileId,
    bounds: { x: 0, y: 0, w, h },
    center,
    grid: { w, h },
    roadGrid,
    roads: [],
    sidewalkGrid,
    zoneGrid,
    densityGrid,
    lots: [],
    structures: [],
    explorationPoints: [],
    ambientProps: [],
    narrativeSlots: [],
  };
}
