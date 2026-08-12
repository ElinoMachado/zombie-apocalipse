import { getStructureDef } from '../catalog/structures';
import type { City, World } from '../model/types';
import { getProfile } from '../profiles';
import {
  compareCityToProfile,
  formatProfileFit,
} from '../pipeline/ProfileStats';
import { validateCity } from '../pipeline/ValidateCity';
import { getPrimaryCity } from '../pipeline/WorldGenerator';

export function formatCitySummary(city: City): string {
  const counts = new Map<string, number>();
  for (const s of city.structures) {
    counts.set(s.typeId, (counts.get(s.typeId) ?? 0) + 1);
  }

  const lines: string[] = [
    `Seed: ${city.seed}`,
    `Profile: ${city.profileId}`,
    `CITY ${city.name} (${city.sizeClass}) ${city.grid.w}×${city.grid.h}`,
    `├── Lotes: ${city.lots.length}`,
    `├── Estradas: ${city.roads.length} segmentos`,
    `├── POIs exploração: ${city.explorationPoints.length}`,
  ];

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  for (let i = 0; i < sorted.length; i++) {
    const [id, n] = sorted[i]!;
    let label = id;
    try {
      label = getStructureDef(id).label;
    } catch {
      /* keep id */
    }
    const branch = i === sorted.length - 1 ? '└──' : '├──';
    lines.push(`${branch} ${n} ${label}`);
  }

  const v = validateCity(city);
  if (v.warnings.length) {
    lines.push('');
    lines.push('Avisos:');
    for (const w of v.warnings) lines.push(`  - ${w}`);
  }
  if (v.errors.length) {
    lines.push('Erros:');
    for (const e of v.errors) lines.push(`  - ${e}`);
  }

  try {
    const profile = getProfile(city.profileId);
    const fit = compareCityToProfile(city, profile);
    lines.push('');
    lines.push(formatProfileFit(fit));
  } catch {
    /* profile em falta */
  }

  return lines.join('\n');
}

export function formatWorldSummary(world: World): string {
  const city = getPrimaryCity(world);
  if (!city) return `Seed: ${world.seed}\n(sem cidade)`;
  return formatCitySummary(city);
}

export function serializeWorld(world: World): string {
  return JSON.stringify(world);
}

export function deserializeWorld(json: string): World {
  return JSON.parse(json) as World;
}
