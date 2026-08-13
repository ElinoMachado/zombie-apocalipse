import {
  ANCHOR_QUOTAS,
  getPrimaries,
  getStructureDef,
} from '../catalog/structures';
import {
  DEFAULT_PLAY_CITY_SIZE,
  type City,
  type CitySizeClass,
  type GenerateWorldOptions,
  type World,
} from '../model/types';
import {
  getDefaultProfileId,
  getProfile,
  type CityProfile,
} from '../profiles';
import { deriveSeed, Rng } from '../rng/Rng';
import { createCityShell } from './CityShell';
import { generateLots } from './LotGenerator';
import { reserveNarrativeSlots } from './NarrativeSlots';
import { placeExplorationPoints } from './PoiPlacer';
import { placeHighwayAmbience } from './HighwayAmbiencePlacer';
import { generateRegionStub } from './RegionGenerator';
import { generateRoads, trimNonHighwayRoadsToUrban } from './RoadGenerator';
import { generateSidewalks } from './SidewalkGenerator';
import { finalizeUrbanEdge } from './urbanFootprint';
import { fillLots, placeAnchors } from './StructurePlacer';
import { resolveAnchorQuotas } from './profilePlacement';
import { validateCity } from './ValidateCity';
import { generateZones } from './ZoneGenerator';

function pickSizeClass(rng: Rng, forced?: CitySizeClass): CitySizeClass {
  if (forced) return forced;
  void rng;
  return DEFAULT_PLAY_CITY_SIZE;
}

function buildCity(
  seed: number,
  sizeClass: CitySizeClass,
  tileSize: number,
  salt: string,
  profile: CityProfile,
): City {
  const cityRng = new Rng(deriveSeed(seed, `city:${sizeClass}:${salt}`));
  const city = createCityShell(seed, sizeClass, tileSize, cityRng, profile.id);

  generateRoads(city, cityRng.fork('roads'), profile);
  generateZones(city, cityRng.fork('zones'), profile);
  trimNonHighwayRoadsToUrban(city, profile.density.ruralEdgeBandFraction);
  generateSidewalks(city);
  finalizeUrbanEdge(city);
  generateLots(city, cityRng.fork('lots'), profile);

  city.narrativeSlots = [];

  placeAnchors(
    city,
    resolveAnchorQuotas(ANCHOR_QUOTAS[sizeClass], profile, sizeClass),
    cityRng.fork('anchors'),
    getStructureDef,
    profile,
  );
  fillLots(city, getPrimaries(), cityRng.fork('fill'), getStructureDef, profile);
  placeExplorationPoints(city, cityRng.fork('pois'));
  placeHighwayAmbience(city, cityRng.fork('highway-ambience'));
  reserveNarrativeSlots(city);

  return city;
}

/**
 * Orquestra o pipeline puro (sem Phaser).
 * Mesma seed + profile + size → mesmo mundo.
 */
export function generateWorld(options: GenerateWorldOptions = {}): World {
  const seed = options.seed ?? Date.now();
  const root = new Rng(seed);
  const sizeClass = pickSizeClass(root.fork('size'), options.sizeClass);
  const tileSize = options.tileSize ?? 12;
  const profile = getProfile(options.profileId ?? getDefaultProfileId());

  let city = buildCity(seed, sizeClass, tileSize, '0', profile);
  for (let attempt = 1; attempt <= 3; attempt++) {
    const v = validateCity(city);
    if (v.ok) break;
    city = buildCity(seed, sizeClass, tileSize, `retry:${attempt}`, profile);
  }

  const region = generateRegionStub(city, root.fork('region'));
  return { seed, regions: [region] };
}

export function getPrimaryCity(world: World) {
  return world.regions[0]?.cities[0] ?? null;
}
