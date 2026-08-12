import { getExplorations } from '../catalog/structures';
import type { City, ExplorationPoint, ZoneType } from '../model/types';
import { Rng } from '../rng/Rng';
import { idx, nextId, pointInRect } from './util';

const ZONE_DENSITY: Partial<Record<ZoneType, number>> = {
  center: 0.035,
  commercial: 0.05,
  mixed: 0.04,
  residential_med: 0.04,
  residential_low: 0.03,
  suburban: 0.03,
  periphery: 0.045,
  industrial: 0.05,
  rural: 0.025,
};

export function placeExplorationPoints(city: City, rng: Rng): void {
  const { w, h } = city.grid;
  const blocked = new Set<number>();

  for (const s of city.structures) {
    for (let y = s.bounds.y; y < s.bounds.y + s.bounds.h; y++) {
      for (let x = s.bounds.x; x < s.bounds.x + s.bounds.w; x++) {
        blocked.add(idx(x, y, w));
      }
    }
  }
  for (let i = 0; i < w * h; i++) {
    if (city.roadGrid[i] || city.sidewalkGrid[i]) blocked.add(i);
  }

  const explorers = getExplorations();
  const points: ExplorationPoint[] = [];
  const area = w * h;
  // 75% mais escassos que o valor anterior (0.012 → 0.003).
  const target = Math.max(4, Math.floor(area * 0.003));
  /** Separação mínima entre POIs (tiles) — evita aglomerados. */
  const minSep = Math.max(10, Math.floor(Math.min(w, h) / 14));
  const minSep2 = minSep * minSep;

  let attempts = 0;
  while (points.length < target && attempts < target * 40) {
    attempts += 1;
    const x = rng.int(1, w - 2);
    const y = rng.int(1, h - 2);
    const i = idx(x, y, w);
    if (blocked.has(i)) continue;

    let tooClose = false;
    for (const p of points) {
      const dx = p.x - x;
      const dy = p.y - y;
      if (dx * dx + dy * dy < minSep2) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    const zone = city.zoneGrid[i]!;
    const dens = ZONE_DENSITY[zone] ?? 0.02;
    if (!rng.chance(dens * 8)) continue;

    const allowed = explorers.filter((d) => d.allowedZones.includes(zone));
    if (allowed.length === 0) continue;
    const def = rng.pick(allowed);

    // Prefer near roads or empty lots
    let nearRoad = false;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const ni = idx(x + dx, y + dy, w);
        if (city.roadGrid[ni]) nearRoad = true;
      }
    }
    const inEmptyLot = city.lots.some(
      (l) => l.structureIds.length === 0 && pointInRect(x, y, l.bounds),
    );
    if (!nearRoad && !inEmptyLot && !rng.chance(0.25)) continue;

    points.push({
      id: nextId('poi'),
      typeId: def.id,
      x,
      y,
      loot: [],
    });
    blocked.add(i);
  }

  city.explorationPoints = points;
}
