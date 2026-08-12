import type { City, Density, Point, RoadType, ZoneType } from '../model/types';
import type { CityProfile } from '../profiles/types';
import { Rng } from '../rng/Rng';
import { sampleDistribution, sampleInt } from '../stats/distribution';
import { buildNearRoadMask } from './roadProximity';
import { isUrbanCell } from './urbanFootprint';
import { idx } from './util';

interface NeighborhoodPole {
  x: number;
  y: number;
  radius: number;
}

function densityFromRadius(t: number, breaks: [number, number, number]): Density {
  const [b0, b1, b2] = breaks;
  if (t < b0) return 'high';
  if (t < b1) return 'medium';
  if (t < b2) return 'low';
  return 'sparse';
}

function hasRoadNearby(
  city: City,
  x: number,
  y: number,
  types: RoadType[],
  radius: number,
): boolean {
  const { w, h } = city.grid;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const r = city.roadGrid[idx(nx, ny, w)];
      if (r && types.includes(r)) return true;
    }
  }
  return false;
}

function nearAt(mask: Uint8Array, w: number, x: number, y: number): boolean {
  return mask[idx(x, y, w)] === 1;
}

function nearestPoleDist(poles: NeighborhoodPole[], x: number, y: number): number {
  let best = Infinity;
  for (const p of poles) {
    best = Math.min(best, Math.hypot(p.x - x, p.y - y) / Math.max(1, p.radius));
  }
  return best;
}

/**
 * Polos comerciais de bairro: longe do centro urbano, perto de avenidas/ruas.
 */
function placeNeighborhoodPoles(
  city: City,
  rng: Rng,
  profile: CityProfile,
): NeighborhoodPole[] {
  const { w, h } = city.grid;
  const maxDist = Math.hypot(w / 2, h / 2) || 1;
  const countDist = profile.zones.neighborhoodPolesBySize[city.sizeClass];
  const count = Math.max(2, sampleInt(rng, countDist));

  const poles: NeighborhoodPole[] = [];
  const candidates: Point[] = [];

  for (let y = 4; y < h - 4; y += 2) {
    for (let x = 4; x < w - 4; x += 2) {
      const d = Math.hypot(x - city.center.x, y - city.center.y) / maxDist;
      // Anel de bairros (não centro, não orla rural extrema)
      if (d < 0.28 || d > 0.72) continue;
      const nearMajor = hasRoadNearby(city, x, y, ['avenue', 'main', 'street'], 3);
      if (!nearMajor) continue;
      if (city.roadGrid[idx(x, y, w)]) continue;
      candidates.push({ x, y });
    }
  }

  const shuffled = rng.shuffle(candidates);
  const minSeparation =
    city.sizeClass === 'large' ? 22 : city.sizeClass === 'medium' ? 18 : 14;

  for (const c of shuffled) {
    if (poles.length >= count) break;
    if (poles.some((p) => Math.hypot(p.x - c.x, p.y - c.y) < minSeparation)) {
      continue;
    }
    poles.push({
      x: c.x,
      y: c.y,
      radius: rng.int(6, city.sizeClass === 'large' ? 11 : 9),
    });
  }

  // Fallback se estradas não geraram candidatos suficientes
  let guard = 0;
  while (poles.length < Math.max(2, count - 1) && guard < 40) {
    guard += 1;
    const angle = rng.float(0, Math.PI * 2);
    const dist = maxDist * rng.float(0.35, 0.58);
    const x = Math.round(city.center.x + Math.cos(angle) * dist);
    const y = Math.round(city.center.y + Math.sin(angle) * dist);
    if (x < 4 || y < 4 || x >= w - 4 || y >= h - 4) continue;
    if (poles.some((p) => Math.hypot(p.x - x, p.y - y) < minSeparation)) continue;
    poles.push({ x, y, radius: rng.int(6, 9) });
  }

  return poles;
}

function zoneFromContext(
  density: Density,
  nearAvenue: boolean,
  nearMain: boolean,
  nearHighway: boolean,
  distNorm: number,
  poleNorm: number,
  centerRadius: number,
): ZoneType {
  // Orla rural ampla
  if (distNorm > 0.78) return 'rural';
  if (distNorm > 0.62 && density === 'sparse') {
    return nearHighway ? 'industrial' : 'rural';
  }
  if (distNorm > 0.55 && density === 'sparse') {
    return nearHighway ? 'industrial' : 'periphery';
  }

  // Polo comercial de bairro
  if (poleNorm < 0.55) return 'commercial';
  if (poleNorm < 0.85) return 'mixed';

  if (nearHighway && distNorm > 0.42) return 'industrial';

  if (density === 'high') {
    if (nearAvenue || nearMain) return distNorm < centerRadius ? 'center' : 'commercial';
    return distNorm < centerRadius + 0.02 ? 'center' : 'mixed';
  }
  if (density === 'medium') {
    if (nearAvenue || nearMain) return 'mixed';
    if (nearHighway) return 'industrial';
    return 'residential_med';
  }
  if (density === 'low') {
    if (nearHighway) return 'industrial';
    if (nearAvenue && distNorm < 0.5) return 'suburban';
    return distNorm > 0.5 ? 'periphery' : 'residential_low';
  }

  if (nearHighway) return 'industrial';
  return distNorm > 0.58 ? 'rural' : 'periphery';
}

function majorityFilter(city: City): void {
  const { w, h } = city.grid;
  const nextZones = city.zoneGrid.slice();
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = idx(x, y, w);
      if (city.roadGrid[i]) continue;
      const counts = new Map<ZoneType, number>();
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const z = city.zoneGrid[idx(x + dx, y + dy, w)]!;
          counts.set(z, (counts.get(z) ?? 0) + 1);
        }
      }
      let best: ZoneType = city.zoneGrid[i]!;
      let bestN = 0;
      for (const [z, n] of counts) {
        if (n > bestN) {
          best = z;
          bestN = n;
        }
      }
      nextZones[i] = best;
    }
  }
  city.zoneGrid = nextZones;
}

/**
 * Densidade radial + polos comerciais de bairro + orla rural reforçada.
 * Parâmetros calibráveis via CityProfile (heurístico até OSM).
 */
export function generateZones(city: City, rng: Rng, profile: CityProfile): void {
  const { w, h } = city.grid;
  const maxDist = Math.hypot(w / 2, h / 2) || 1;
  const breaks = profile.density.radialBreaks;
  const poles = placeNeighborhoodPoles(city, rng, profile);
  const centerRadius = Math.min(
    0.35,
    Math.max(0.08, sampleDistribution(rng, profile.centers.centerRadiusNorm)),
  );

  const nearAvenue = buildNearRoadMask(city, ['avenue'], 3);
  const nearMain = buildNearRoadMask(city, ['main'], 3);
  const nearHighway = buildNearRoadMask(city, ['highway'], 4);
  const nearHighwayEdge = buildNearRoadMask(city, ['highway'], 3);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = idx(x, y, w);
      if (city.roadGrid[i]) {
        city.densityGrid[i] = 'medium';
        city.zoneGrid[i] = isUrbanCell(
          city,
          x,
          y,
          profile.density.ruralEdgeBandFraction,
        )
          ? 'mixed'
          : 'rural';
        continue;
      }

      let distNorm = Math.hypot(x - city.center.x, y - city.center.y) / maxDist;
      distNorm += rng.float(-0.02, 0.02);
      distNorm = Math.max(0, Math.min(1, distNorm));

      let density = densityFromRadius(distNorm, breaks);
      const av = nearAt(nearAvenue, w, x, y);
      const mn = nearAt(nearMain, w, x, y);
      const hw = nearAt(nearHighway, w, x, y);
      const poleNorm = nearestPoleDist(poles, x, y);

      if (distNorm < breaks[2] && (av || mn)) {
        if (density === 'sparse') density = 'low';
        else if (density === 'low') density = 'medium';
      }
      if (hw && distNorm > 0.4 && distNorm < 0.7 && rng.chance(0.5)) {
        density = density === 'high' ? 'medium' : density;
      }

      if (poleNorm < 1) {
        density = density === 'sparse' || density === 'low' ? 'medium' : density;
      }

      city.densityGrid[i] = density;
      city.zoneGrid[i] = zoneFromContext(
        density,
        av,
        mn,
        hw,
        distNorm,
        poleNorm,
        centerRadius,
      );
    }
  }

  // Reforça rural na borda (anel exterior)
  const ruralBand = Math.max(
    8,
    Math.floor(Math.min(w, h) * profile.density.ruralEdgeBandFraction),
  );
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = idx(x, y, w);
      const edge =
        Math.min(x, y, w - 1 - x, h - 1 - y) < ruralBand ||
        Math.hypot(x - city.center.x, y - city.center.y) / maxDist > 0.7;
      if (!edge) continue;

      if (city.roadGrid[i]) {
        city.zoneGrid[i] = 'rural';
        city.densityGrid[i] = 'sparse';
        continue;
      }

      if (nearAt(nearHighwayEdge, w, x, y) && rng.chance(0.35)) {
        city.zoneGrid[i] = 'industrial';
        city.densityGrid[i] = 'low';
      } else {
        city.zoneGrid[i] = rng.chance(0.7) ? 'rural' : 'periphery';
        city.densityGrid[i] = 'sparse';
      }
    }
  }

  // Garante mancha comercial em cada polo (após rural, para não apagar o centro do polo)
  for (const pole of poles) {
    for (let y = pole.y - pole.radius; y <= pole.y + pole.radius; y++) {
      for (let x = pole.x - pole.radius; x <= pole.x + pole.radius; x++) {
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const i = idx(x, y, w);
        if (city.roadGrid[i]) continue;
        const d = Math.hypot(x - pole.x, y - pole.y);
        if (d > pole.radius) continue;
        // Não sobrescrever orla muito rural distante do polo se o polo ficou na borda
        if (city.zoneGrid[i] === 'rural' && d > pole.radius * 0.55) continue;
        city.zoneGrid[i] = d < pole.radius * 0.55 ? 'commercial' : 'mixed';
        city.densityGrid[i] = 'medium';
      }
    }
  }

  const passes = Math.max(1, profile.transitions.smoothPasses);
  for (let p = 0; p < passes; p++) {
    majorityFilter(city);
  }
}
