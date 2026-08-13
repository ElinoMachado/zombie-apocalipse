import type { SurvivalState } from './SurvivalState';

export interface StatusBadge {
  id: string;
  label: string;
  color: string;
}

/** Badges activos para HUD / ficha — sangramento, infecção, buffs, etc. */
export function collectPlayerStatusBadges(
  survival: SurvivalState,
  opts: { burning?: boolean } = {},
): StatusBadge[] {
  const badges: StatusBadge[] = [];

  if (opts.burning) {
    badges.push({ id: 'burning', label: 'Queimadura', color: '#ff7043' });
  }
  if (survival.bleeding) {
    badges.push({ id: 'bleeding', label: 'Sangramento', color: '#f85149' });
  }
  if (survival.infection === 'mild') {
    badges.push({ id: 'infection-mild', label: 'Infecção leve', color: '#d29922' });
  }
  if (survival.infection === 'advanced') {
    badges.push({
      id: 'infection-advanced',
      label: 'Infecção avançada',
      color: '#da3633',
    });
  }
  if (survival.minorWounds) {
    badges.push({
      id: 'minor-wounds',
      label: 'Ferimentos leves',
      color: '#f0883e',
    });
  }
  if (survival.majorWounds) {
    badges.push({
      id: 'major-wounds',
      label: 'Ferimentos graves',
      color: '#f85149',
    });
  }
  if (survival.hasAdrenaline()) {
    badges.push({ id: 'adrenaline', label: 'Adrenalina', color: '#58a6ff' });
  }
  if (survival.speedMultiplier() > 1) {
    badges.push({ id: 'speed-buff', label: 'Velocidade+', color: '#3fb950' });
  }
  if (survival.hasWoundPenalty()) {
    badges.push({ id: 'wound-pain', label: 'Dor', color: '#8b949e' });
  }
  if (survival.gameTime < survival.stimCrashUntil) {
    badges.push({
      id: 'stim-crash',
      label: 'Crash estimulante',
      color: '#6e7681',
    });
  }

  return badges;
}
