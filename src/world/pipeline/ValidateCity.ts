import type { City, RoadType } from '../model/types';
import { idx, rectsOverlap } from './util';

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

function roadConnectivity(city: City): boolean {
  const { w, h } = city.grid;
  const start = idx(city.center.x, city.center.y, w);
  // Se o centro não é estrada, procurar estrada vizinha
  let sx = city.center.x;
  let sy = city.center.y;
  if (!city.roadGrid[start]) {
    let found = false;
    for (let r = 1; r <= 6 && !found; r++) {
      for (let dy = -r; dy <= r && !found; dy++) {
        for (let dx = -r; dx <= r && !found; dx++) {
          const x = city.center.x + dx;
          const y = city.center.y + dy;
          if (x < 0 || y < 0 || x >= w || y >= h) continue;
          if (city.roadGrid[idx(x, y, w)]) {
            sx = x;
            sy = y;
            found = true;
          }
        }
      }
    }
    if (!found) return false;
  }

  const seen = new Set<number>();
  const q: number[] = [idx(sx, sy, w)];
  seen.add(q[0]!);
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  while (q.length) {
    const cur = q.pop()!;
    const cx = cur % w;
    const cy = Math.floor(cur / w);
    for (const [dx, dy] of dirs) {
      const nx = cx + dx!;
      const ny = cy + dy!;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = idx(nx, ny, w);
      if (seen.has(ni)) continue;
      if (!city.roadGrid[ni]) continue;
      seen.add(ni);
      q.push(ni);
    }
  }

  let totalRoad = 0;
  for (let i = 0; i < w * h; i++) if (city.roadGrid[i]) totalRoad += 1;
  return totalRoad > 0 && seen.size / totalRoad >= 0.85;
}

function structureOnRoad(city: City): boolean {
  const { w } = city.grid;
  for (const s of city.structures) {
    for (let y = s.bounds.y; y < s.bounds.y + s.bounds.h; y++) {
      for (let x = s.bounds.x; x < s.bounds.x + s.bounds.w; x++) {
        if (city.roadGrid[idx(x, y, w)]) return true;
      }
    }
  }
  return false;
}

function structureOverlaps(city: City): boolean {
  for (let i = 0; i < city.structures.length; i++) {
    for (let j = i + 1; j < city.structures.length; j++) {
      if (rectsOverlap(city.structures[i]!.bounds, city.structures[j]!.bounds)) {
        return true;
      }
    }
  }
  return false;
}

export function validateCity(city: City): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (structureOnRoad(city)) {
    errors.push('Estrutura sobrepõe estrada');
  }
  if (structureOverlaps(city)) {
    errors.push('Estruturas sobrepostas');
  }
  if (!roadConnectivity(city)) {
    warnings.push('Rede viária pouco conectada (<85% alcançável do centro)');
  }

  const hasClinicOrHospital = city.structures.some(
    (s) => s.typeId === 'hospital' || s.typeId === 'clinic',
  );
  if (city.sizeClass !== 'small' && !hasClinicOrHospital) {
    warnings.push('Cidade sem hospital/clínica');
  }

  const roadTypes = new Set<RoadType>();
  for (const cell of city.roadGrid) {
    if (cell) roadTypes.add(cell);
  }
  if (!roadTypes.has('main') && !roadTypes.has('highway')) {
    warnings.push('Sem rodovia/estrada principal');
  }

  return { ok: errors.length === 0, errors, warnings };
}
