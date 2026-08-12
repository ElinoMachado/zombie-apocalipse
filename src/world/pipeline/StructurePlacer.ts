import type { StructureDefinition } from '../catalog/types';
import type { City, Lot, Point, Rect, StructureInstance } from '../model/types';
import type { CityProfile } from '../profiles/types';
import { Rng } from '../rng/Rng';
import { effectiveMaxPerCity, poiRuleMap } from './profilePlacement';
import { buildMajorRoadDistance, buildStreetscapeDistance } from './roadProximity';
import { containsRect, idx, nextId, rectsOverlap } from './util';

const ROAD_PREF_SCORE: Record<string, number> = {
  highway: 1,
  main: 0.85,
  avenue: 0.7,
  street: 0.5,
  residential: 0.35,
};

/** Cache por cidade durante uma passada de scoring/placement. */
let majorDistCache: { city: City; dist: Uint8Array } | null = null;
let streetDistCache: { city: City; dist: Uint8Array } | null = null;

function majorRoadDistField(city: City): Uint8Array {
  if (majorDistCache?.city === city) return majorDistCache.dist;
  const dist = buildMajorRoadDistance(city);
  majorDistCache = { city, dist };
  return dist;
}

function streetscapeDistField(city: City): Uint8Array {
  if (streetDistCache?.city === city) return streetDistCache.dist;
  const dist = buildStreetscapeDistance(city);
  streetDistCache = { city, dist };
  return dist;
}

function distToMajorRoadTiles(city: City, lot: Lot): number {
  const { w } = city.grid;
  const dist = majorRoadDistField(city);
  const x = Math.round(lot.bounds.x + lot.bounds.w / 2);
  const y = Math.round(lot.bounds.y + lot.bounds.h / 2);
  return dist[idx(x, y, w)] ?? 255;
}

type PlaceMode = 'center' | 'edge' | 'street';

function hasStreetFrontage(lot: Lot): boolean {
  const a = lot.roadAccess;
  return a.touchN || a.touchE || a.touchS || a.touchW;
}

function streetEdgeScore(city: City, r: Rect, lot: Lot): number {
  const a = lot.roadAccess;
  const { w } = city.grid;
  const dist = streetscapeDistField(city);
  let s = 0;
  if (a.touchN && r.y === lot.bounds.y) s += 20;
  if (a.touchS && r.y + r.h === lot.bounds.y + lot.bounds.h) s += 20;
  if (a.touchW && r.x === lot.bounds.x) s += 20;
  if (a.touchE && r.x + r.w === lot.bounds.x + lot.bounds.w) s += 20;

  // Quatro pontos médios das faces do footprint
  const samples: [number, number][] = [
    [r.x + (r.w >> 1), r.y],
    [r.x + (r.w >> 1), r.y + r.h - 1],
    [r.x, r.y + (r.h >> 1)],
    [r.x + r.w - 1, r.y + (r.h >> 1)],
  ];
  let best = 255;
  for (const [sx, sy] of samples) {
    best = Math.min(best, dist[idx(sx, sy, w)] ?? 255);
  }
  s += Math.max(0, 16 - best * 2);
  return s;
}

function placeInLot(
  city: City,
  lot: Lot,
  footprint: { w: number; h: number },
  occupied: Rect[],
  rng: Rng,
  mode: PlaceMode = 'center',
): Rect | null {
  const maxX = lot.bounds.x + lot.bounds.w - footprint.w;
  const maxY = lot.bounds.y + lot.bounds.h - footprint.h;
  if (maxX < lot.bounds.x || maxY < lot.bounds.y) return null;

  type Cand = { rect: Rect; score: number };
  const candidates: Cand[] = [];

  for (let y = lot.bounds.y; y <= maxY; y++) {
    for (let x = lot.bounds.x; x <= maxX; x++) {
      const rect = { x, y, w: footprint.w, h: footprint.h };
      if (!containsRect(lot.bounds, rect)) continue;
      if (occupied.some((o) => rectsOverlap(o, rect, 0))) continue;

      let score = 0;
      if (mode === 'street') {
        score = streetEdgeScore(city, rect, lot);
      } else if (mode === 'edge') {
        const onEdge =
          rect.x === lot.bounds.x ||
          rect.y === lot.bounds.y ||
          rect.x + rect.w === lot.bounds.x + lot.bounds.w ||
          rect.y + rect.h === lot.bounds.y + lot.bounds.h;
        score = onEdge ? 10 : 0;
        const { w } = city.grid;
        const d = streetscapeDistField(city);
        score += Math.max(0, 8 - (d[idx(x, y, w)] ?? 8));
      } else {
        const cx = lot.bounds.x + lot.bounds.w / 2;
        const cy = lot.bounds.y + lot.bounds.h / 2;
        score = -Math.hypot(rect.x + rect.w / 2 - cx, rect.y + rect.h / 2 - cy);
      }
      candidates.push({ rect, score });
    }
  }
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0]!.score;
  const pool = candidates
    .filter((c) => c.score >= best - (mode === 'street' ? 3 : 2))
    .slice(0, 8);
  return rng.pick(pool).rect;
}

function entranceFor(bounds: Rect, lot: Lot): { x: number; y: number } {
  const a = lot.roadAccess;
  const mx = bounds.x + Math.floor(bounds.w / 2);
  const my = bounds.y + Math.floor(bounds.h / 2);

  if (a.touchS && bounds.y + bounds.h === lot.bounds.y + lot.bounds.h) {
    return { x: mx, y: bounds.y + bounds.h };
  }
  if (a.touchN && bounds.y === lot.bounds.y) {
    return { x: mx, y: bounds.y };
  }
  if (a.touchE && bounds.x + bounds.w === lot.bounds.x + lot.bounds.w) {
    return { x: bounds.x + bounds.w, y: my };
  }
  if (a.touchW && bounds.x === lot.bounds.x) {
    return { x: bounds.x, y: my };
  }
  return { x: mx, y: bounds.y + bounds.h };
}

function makeInstance(
  def: StructureDefinition,
  lot: Lot,
  bounds: Rect,
  parentId: string | null,
): StructureInstance {
  const door = entranceFor(bounds, lot);
  return {
    id: nextId('struct'),
    typeId: def.id,
    category: def.category,
    lotId: lot.id,
    parentId,
    bounds,
    rooms: [],
    entrances: [{ id: nextId('ent'), x: door.x, y: door.y }],
    metadata: {},
  };
}

function primaryPlaceMode(lot: Lot): PlaceMode {
  if (lot.zone === 'rural') return 'center';
  // Sempre puxar para a frente da quadra (via/calçada) na área urbana
  return 'street';
}

export function scoreStructure(
  def: StructureDefinition,
  lot: Lot,
  city: City,
  profile?: CityProfile,
): number {
  const w = def.scoreWeights;
  let score = 0;

  if (def.allowedZones.includes(lot.zone)) {
    score += 25 * w.zone;
  } else {
    return -9999;
  }

  if (lot.roadAccess.fraction < def.minRoadAccess) {
    score -= 50 * w.road;
  } else {
    score += Math.min(30, lot.roadAccess.fraction * 40) * w.road;
  }
  if (
    lot.roadAccess.bestRoadType &&
    def.preferredRoadTypes.includes(lot.roadAccess.bestRoadType)
  ) {
    score += 15 * w.road * (ROAD_PREF_SCORE[lot.roadAccess.bestRoadType] ?? 0.5);
  }

  // Preferir lotes na borda da quadra (frente para via)
  if (lot.zone !== 'rural' && hasStreetFrontage(lot)) {
    score += 22 * w.road;
  } else if (lot.zone !== 'rural' && lot.roadAccess.fraction < 0.05) {
    score -= 18 * w.road;
  }

  if (def.preferredDensity.includes(lot.density)) {
    score += 18 * w.density;
  } else {
    score -= 8 * w.density;
  }

  if (lot.size < def.lotSizeRange.min) {
    score -= 25 * w.lot;
  } else if (lot.size > def.lotSizeRange.max) {
    score -= 5 * w.lot;
  } else {
    score += 20 * w.lot;
  }

  if (
    def.footprint.w + 1 > lot.bounds.w ||
    def.footprint.h + 1 > lot.bounds.h
  ) {
    return -9999;
  }

  const lx = lot.bounds.x + lot.bounds.w / 2;
  const ly = lot.bounds.y + lot.bounds.h / 2;
  const maxDist =
    Math.sqrt((city.grid.w / 2) ** 2 + (city.grid.h / 2) ** 2) || 1;
  const dist =
    Math.sqrt((lx - city.center.x) ** 2 + (ly - city.center.y) ** 2) / maxDist;

  if (def.id === 'farm' || def.id === 'farmhouse') {
    score += dist * 25 * w.center;
  } else if (def.isCityAnchor && def.allowedZones.includes('center')) {
    score += (1 - dist) * 20 * w.center;
  } else if (def.id === 'factory' || def.id === 'industrial_yard') {
    score += dist * 10 * w.center;
  } else {
    score += (1 - Math.abs(dist - 0.4)) * 8 * w.center;
  }

  if (def.forbiddenNearby) {
    for (const rule of def.forbiddenNearby) {
      if (!rule.zone) continue;
      const near = lot.neighbors.some((nid) => {
        const n = city.lots.find((l) => l.id === nid);
        return n?.zone === rule.zone;
      });
      if (near) score -= (rule.penalty ?? 20) * w.nearby;
    }
  }

  score += (1 - def.rarity) * 5;

  // Overlay CityProfile.poiRules (zonas / vias / distância a via major)
  const poi = profile ? poiRuleMap(profile).get(def.id) : undefined;
  if (poi) {
    if (poi.preferredZones.includes(lot.zone)) {
      score += 14 * w.zone;
    } else {
      score -= 8 * w.zone;
    }
    if (lot.roadAccess.fraction < poi.minRoadAccess) {
      score -= 25 * w.road;
    }
    if (
      lot.roadAccess.bestRoadType &&
      poi.preferredRoadTypes.includes(lot.roadAccess.bestRoadType)
    ) {
      score +=
        12 * w.road * (ROAD_PREF_SCORE[lot.roadAccess.bestRoadType] ?? 0.5);
    }
    if (poi.distanceToMajorRoad && poi.distanceToMajorRoad.sampleSize > 0) {
      const d = distToMajorRoadTiles(city, lot);
      const target = poi.distanceToMajorRoad.p50;
      score += Math.max(-12, 10 - Math.abs(d - target) * 1.2);
    }
    if (poi.distanceToCenterNorm && poi.distanceToCenterNorm.sampleSize > 0) {
      const target = poi.distanceToCenterNorm.p50;
      score += Math.max(-10, 8 - Math.abs(dist - target) * 20);
    }
  }

  return score;
}

function occupiedInLot(city: City, lot: Lot): Rect[] {
  return city.structures
    .filter((s) => s.lotId === lot.id)
    .map((s) => s.bounds);
}

function countType(city: City, typeId: string): number {
  return city.structures.filter((s) => s.typeId === typeId).length;
}

function placeChildRules(
  city: City,
  parent: StructureInstance,
  lot: Lot,
  rules: { childId: string; chance: number; min: number; max: number }[],
  rng: Rng,
  getDef: (id: string) => StructureDefinition,
  skipIds: Set<string>,
): void {
  let occupied = occupiedInLot(city, lot);
  for (const rule of rules) {
    if (skipIds.has(rule.childId)) continue;
    if (!rng.chance(rule.chance)) continue;
    const count = rng.int(rule.min, rule.max);
    let childDef: StructureDefinition;
    try {
      childDef = getDef(rule.childId);
    } catch {
      continue;
    }
    for (let n = 0; n < count; n++) {
      const rect = placeInLot(
        city,
        lot,
        childDef.footprint,
        [...occupied, parent.bounds],
        rng,
        hasStreetFrontage(lot) ? 'street' : 'edge',
      );
      if (!rect) break;
      const child = makeInstance(childDef, lot, rect, parent.id);
      city.structures.push(child);
      lot.structureIds.push(child.id);
      occupied.push(rect);
    }
  }
}

function placeComposition(
  city: City,
  parent: StructureInstance,
  lot: Lot,
  def: StructureDefinition,
  rng: Rng,
  getDef: (id: string) => StructureDefinition,
  profile?: CityProfile,
): void {
  const catalog = def.composition ?? [];
  const catalogIds = new Set(catalog.map((c) => c.childId));
  placeChildRules(city, parent, lot, catalog, rng, getDef, new Set());

  if (!profile) return;
  const extras = profile.dependencies.filter((d) => d.parentId === parent.typeId);
  placeChildRules(city, parent, lot, extras, rng, getDef, catalogIds);
}

export function placeAnchors(
  city: City,
  quotas: Partial<Record<string, number>>,
  rng: Rng,
  getDef: (id: string) => StructureDefinition,
  profile?: CityProfile,
): void {
  const freeLots = () => city.lots.filter((l) => l.structureIds.length === 0);

  for (const [typeId, need] of Object.entries(quotas)) {
    if (!need || need <= 0) continue;
    let def: StructureDefinition;
    try {
      def = getDef(typeId);
    } catch {
      continue;
    }
    for (let n = 0; n < need; n++) {
      const max = effectiveMaxPerCity(
        typeId,
        def.maxPerCity,
        profile,
        city.sizeClass,
      );
      if (max !== undefined && countType(city, typeId) >= max) {
        break;
      }
      const candidates = freeLots()
        .filter(
          (lot) =>
            def.allowedZones.includes(lot.zone) &&
            lot.bounds.w >= def.footprint.w + 1 &&
            lot.bounds.h >= def.footprint.h + 1,
        )
        .map((lot) => ({
          lot,
          score:
            scoreStructure(def, lot, city, profile) +
            rng.float(-8, 8) * def.scoreWeights.random,
        }))
        .filter((c) => c.score > -5000)
        .sort((a, b) => b.score - a.score);

      if (candidates.length === 0) {
        const fallback = freeLots()
          .filter((lot) => def.allowedZones.includes(lot.zone))
          .filter(
            (lot) =>
              lot.bounds.w >= def.footprint.w &&
              lot.bounds.h >= def.footprint.h,
          )
          .sort((a, b) => b.size - a.size);
        if (fallback.length === 0) break;
        const lot = fallback[0]!;
        const rect = placeInLot(
          city,
          lot,
          def.footprint,
          occupiedInLot(city, lot),
          rng,
          primaryPlaceMode(lot),
        );
        if (!rect) break;
        const inst = makeInstance(def, lot, rect, null);
        city.structures.push(inst);
        lot.structureIds.push(inst.id);
        placeComposition(city, inst, lot, def, rng, getDef, profile);
        continue;
      }
      const topK = candidates.slice(0, Math.min(5, candidates.length));
      const chosen = rng.pickWeightedItems(topK, (c) => Math.max(1, c.score + 50));
      if (!chosen) break;

      const occupied = occupiedInLot(city, chosen.lot);
      const rect = placeInLot(
        city,
        chosen.lot,
        def.footprint,
        occupied,
        rng,
        primaryPlaceMode(chosen.lot),
      );
      if (!rect) continue;

      const inst = makeInstance(def, chosen.lot, rect, null);
      city.structures.push(inst);
      chosen.lot.structureIds.push(inst.id);
      placeComposition(city, inst, chosen.lot, def, rng, getDef, profile);
    }
  }
}

export function fillLots(
  city: City,
  primaries: StructureDefinition[],
  rng: Rng,
  getDef: (id: string) => StructureDefinition,
  profile: CityProfile,
): void {
  const emptyChance = profile.lots.emptyLotChanceByDensity;

  const lots = rng.shuffle([...city.lots.filter((l) => l.structureIds.length === 0)]);

  for (const lot of lots) {
    // Interiores de quadra sem frente para rua: muitas vezes vazios
    if (
      lot.zone !== 'rural' &&
      !hasStreetFrontage(lot) &&
      rng.chance(0.65)
    ) {
      continue;
    }
    if (rng.chance(emptyChance[lot.density] ?? 0.2)) continue;

    const scored = primaries
      .filter((d) => d.category === 'primary')
      .map((def) => {
        const max = effectiveMaxPerCity(
          def.id,
          def.maxPerCity,
          profile,
          city.sizeClass,
        );
        if (max !== undefined && countType(city, def.id) >= max) {
          return null;
        }
        const base = scoreStructure(def, lot, city, profile);
        if (base < -500) return null;
        const jitter = rng.float(-10, 10) * def.scoreWeights.random;
        return { def, score: base + jitter };
      })
      .filter((x): x is { def: StructureDefinition; score: number } => x !== null)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) continue;
    const topK = scored.slice(0, Math.min(3, scored.length));
    const pick = rng.pickWeightedItems(topK, (c) => Math.max(1, c.score + 40));
    if (!pick || pick.score < 0) continue;

    const rect = placeInLot(
      city,
      lot,
      pick.def.footprint,
      [],
      rng,
      primaryPlaceMode(lot),
    );
    if (!rect) continue;

    const inst = makeInstance(pick.def, lot, rect, null);
    city.structures.push(inst);
    lot.structureIds.push(inst.id);
    placeComposition(city, inst, lot, pick.def, rng, getDef, profile);
  }
}

export function cityCenterPoint(city: City): Point {
  return { ...city.center };
}
