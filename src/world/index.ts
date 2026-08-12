export { generateWorld, getPrimaryCity } from './pipeline/WorldGenerator';
export {
  formatCitySummary,
  formatWorldSummary,
  serializeWorld,
  deserializeWorld,
} from './debug/WorldDump';
export {
  getProfile,
  listProfiles,
  getDefaultProfileId,
  HeuristicV1,
} from './profiles';
export type { CityProfile } from './profiles';
export {
  fromSamples,
  sampleDistribution,
  sampleInt,
  dist,
} from './stats';
export {
  compareCityToProfile,
  formatProfileFit,
} from './pipeline/ProfileStats';
export {
  resolveAnchorQuotas,
  effectiveMaxPerCity,
} from './pipeline/profilePlacement';
export type * from './model/types';
