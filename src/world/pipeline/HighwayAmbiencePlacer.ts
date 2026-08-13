import type { AmbientProp, City, RoadType, ZoneType } from '../model/types';
import { Rng } from '../rng/Rng';
import { pickWreckedCarFrame } from '../../assets/wreckedCars';
import { POI_CAR_CLEARANCE_TILES, tooCloseToNonCarPois } from './poiCarClearance';
import { idx, inBounds, nextId } from './util';

const ORTHO = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

const URBAN_STREET_ROADS: readonly RoadType[] = [
  'main',
  'avenue',
  'street',
  'residential',
];

interface RoadAmbienceConfig {
  readonly roads: readonly RoadType[];
  readonly step: number;
  readonly spawnChance: number;
  readonly wreckedCarShare: number;
  readonly zoneFilter?: (zone: ZoneType) => boolean;
}

/**
 * Ambientação viária: escombros, carros destruídos, fogos e postes.
 * Highways têm mais carros; ruas urbanas têm menos.
 */
export function placeHighwayAmbience(city: City, rng: Rng): void {
  const { w } = city.grid;
  const occupied = new Set<number>();
  const props: AmbientProp[] = [];

  const highwayStep = Math.max(
    6,
    Math.floor(14 / (city.sizeClass === 'large' ? 1.2 : 1)),
  );

  scatterRoadAmbience(city, rng, props, occupied, {
    roads: ['highway'],
    step: highwayStep,
    spawnChance: 0.55,
    wreckedCarShare: 0.28,
  });

  scatterRoadAmbience(city, rng, props, occupied, {
    roads: URBAN_STREET_ROADS,
    step: Math.max(10, Math.floor(highwayStep * 2.6)),
    spawnChance: 0.26,
    wreckedCarShare: 0.2,
    zoneFilter: (zone) => zone !== 'rural',
  });

  const highwayCells = collectRoadCells(city, ['highway']);
  const lampSpacing = city.sizeClass === 'small' ? 18 : 14;
  let lampCounter = 0;
  for (const cell of highwayCells) {
    lampCounter += 1;
    if (lampCounter % lampSpacing !== 0) continue;
    if (rng.next() > 0.7) continue;

    const edge = findLampSpot(city, cell.x, cell.y, occupied, rng);
    if (!edge) continue;
    const iEdge = idx(edge.x, edge.y, w);
    occupied.add(iEdge);
    props.push({
      id: nextId('amb'),
      kind: 'lamp_post',
      x: edge.x,
      y: edge.y,
      rotation: 0,
    });
  }

  city.ambientProps = props;
}

function collectRoadCells(
  city: City,
  roads: readonly RoadType[],
): { x: number; y: number }[] {
  const { w, h } = city.grid;
  const set = new Set(roads);
  const cells: { x: number; y: number }[] = [];
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const road = city.roadGrid[idx(x, y, w)];
      if (road && set.has(road)) cells.push({ x, y });
    }
  }
  return cells;
}

function scatterRoadAmbience(
  city: City,
  rng: Rng,
  props: AmbientProp[],
  occupied: Set<number>,
  cfg: RoadAmbienceConfig,
): void {
  const { w } = city.grid;
  const cells = collectRoadCells(city, cfg.roads);
  for (let i = 0; i < cells.length; i += cfg.step) {
    if (!rng.chance(cfg.spawnChance)) continue;
    const cell = cells[i]!;
    const iCell = idx(cell.x, cell.y, w);
    if (occupied.has(iCell)) continue;

    const zone = city.zoneGrid[iCell]!;
    if (cfg.zoneFilter && !cfg.zoneFilter(zone)) continue;

    occupied.add(iCell);
    const roll = rng.next();
    const canPlaceWreckedCar = !tooCloseToNonCarPois(
      cell.x,
      cell.y,
      city.explorationPoints,
      POI_CAR_CLEARANCE_TILES,
    );
    let kind: AmbientProp['kind'];
    if (roll < cfg.wreckedCarShare && canPlaceWreckedCar) kind = 'wrecked_car';
    else if (roll < cfg.wreckedCarShare + 0.14) kind = 'burning_debris';
    else kind = 'debris';

    props.push({
      id: nextId('amb'),
      kind,
      x: cell.x,
      y: cell.y,
      rotation: rng.next() * Math.PI * 2,
      ...(kind === 'wrecked_car'
        ? {
            sheet: 'props-wrecked-cars',
            frame: pickWreckedCarFrame(`${city.seed}:${cell.x},${cell.y}`),
            scale: 1,
            blocks: true,
          }
        : {}),
    });
  }
}

function findLampSpot(
  city: City,
  hx: number,
  hy: number,
  occupied: Set<number>,
  rng: Rng,
): { x: number; y: number } | null {
  const { w, h } = city.grid;
  const candidates: { x: number; y: number }[] = [];
  for (const [dx, dy] of ORTHO) {
    const x = hx + dx;
    const y = hy + dy;
    if (!inBounds(x, y, w, h)) continue;
    const i = idx(x, y, w);
    if (occupied.has(i)) continue;
    if (city.roadGrid[i]) continue;
    candidates.push({ x, y });
  }
  if (candidates.length === 0) return null;
  return rng.pick(candidates);
}
