import type { AmbientProp, City } from '../model/types';
import { Rng } from '../rng/Rng';
import { pickWreckedCarFrame } from '../../assets/wreckedCars';
import { idx, inBounds, nextId } from './util';

const ORTHO = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/**
 * Ambientação de highways: escombros, carros destruídos, fogos e postes.
 * Densidade baixa para não saturar o streaming.
 */
export function placeHighwayAmbience(city: City, rng: Rng): void {
  const { w, h } = city.grid;
  const occupied = new Set<number>();
  const props: AmbientProp[] = [];

  const highwayCells: { x: number; y: number }[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (city.roadGrid[idx(x, y, w)] === 'highway') {
        highwayCells.push({ x, y });
      }
    }
  }

  // Escombros / carros / fogos no asfalto
  const step = Math.max(6, Math.floor(14 / (city.sizeClass === 'large' ? 1.2 : 1)));
  for (let i = 0; i < highwayCells.length; i += step) {
    if (rng.next() > 0.55) continue;
    const cell = highwayCells[i]!;
    const iCell = idx(cell.x, cell.y, w);
    if (occupied.has(iCell)) continue;
    occupied.add(iCell);

    const roll = rng.next();
    let kind: AmbientProp['kind'];
    if (roll < 0.28) kind = 'wrecked_car';
    else if (roll < 0.42) kind = 'burning_debris';
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

  // Postes de luz: bordo da highway (calçada ou tile adjacente não-estrada)
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
    // Preferir calçada; aceitar rural adjacente
    candidates.push({ x, y });
  }
  if (candidates.length === 0) return null;
  return rng.pick(candidates);
}
