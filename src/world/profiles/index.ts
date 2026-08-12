export type * from './types';
export { HeuristicV1 } from './HeuristicV1';
export {
  registerProfile,
  getProfile,
  listProfiles,
  getDefaultProfileId,
} from './registry';
import { registerOsmDerivedProfiles } from './generated/OsmProfiles';

registerOsmDerivedProfiles();
