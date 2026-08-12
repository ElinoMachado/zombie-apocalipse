import { HeuristicV1 } from './HeuristicV1';
import type { CityProfile } from './types';

const registry = new Map<string, CityProfile>([[HeuristicV1.id, HeuristicV1]]);

export function registerProfile(profile: CityProfile): void {
  registry.set(profile.id, profile);
}

export function getProfile(id: string): CityProfile {
  const p = registry.get(id);
  if (!p) {
    throw new Error(
      `CityProfile not found: ${id}. Known: ${[...registry.keys()].join(', ')}`,
    );
  }
  return p;
}

export function listProfiles(): CityProfile[] {
  return [...registry.values()];
}

export function getDefaultProfileId(): string {
  return HeuristicV1.id;
}
