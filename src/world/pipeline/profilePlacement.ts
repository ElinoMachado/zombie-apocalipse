import type { CitySizeClass } from '../model/types';
import type { CityProfile, POIRule } from '../profiles/types';

/** Índice structureId → regra OSM/heurística. */
export function poiRuleMap(profile: CityProfile): Map<string, POIRule> {
  const map = new Map<string, POIRule>();
  for (const rule of profile.poiRules) {
    map.set(rule.structureId, rule);
  }
  return map;
}

/**
 * Combina quotas de âncora do catálogo com `maxPerCityBySize` do profile.
 * Cap 0 remove o tipo; caps menores reduzem a quota.
 */
export function resolveAnchorQuotas(
  base: Partial<Record<string, number>>,
  profile: CityProfile,
  sizeClass: CitySizeClass,
): Partial<Record<string, number>> {
  const out: Partial<Record<string, number>> = { ...base };
  for (const rule of profile.poiRules) {
    const cap = rule.maxPerCityBySize?.[sizeClass];
    if (cap === undefined) continue;
    const current = out[rule.structureId];
    if (current === undefined) {
      if (cap > 0) out[rule.structureId] = cap;
      continue;
    }
    out[rule.structureId] = Math.min(current, cap);
  }
  return out;
}

/** Teto efectivo: profile.maxPerCityBySize ganha ao catálogo quando definido. */
export function effectiveMaxPerCity(
  structureId: string,
  catalogMax: number | undefined,
  profile: CityProfile | undefined,
  sizeClass: CitySizeClass,
): number | undefined {
  if (!profile) return catalogMax;
  const cap = poiRuleMap(profile).get(structureId)?.maxPerCityBySize?.[sizeClass];
  if (cap !== undefined) {
    if (catalogMax === undefined) return cap;
    return Math.min(catalogMax, cap);
  }
  return catalogMax;
}
