/** Gerado por tools/audio/sync-zombie-sounds.mjs — não editar à mão. */
export interface ZombieSoundEntry {
  key: string;
  file: string;
}

export const ZOMBIE_IDLE_SOUNDS: readonly ZombieSoundEntry[] = [
  { key: 'sfx-zombie-idle-0', file: 'assets/audio/female-zombie-idle.mp3' },
  { key: 'sfx-zombie-idle-1', file: 'assets/audio/male-zombie-idle.mp3' },
];

export const ZOMBIE_ATTACKING_SOUNDS: readonly ZombieSoundEntry[] = [
  { key: 'sfx-zombie-attacking-0', file: 'assets/audio/zombie-attacking-1.mp3' },
  { key: 'sfx-zombie-attacking-1', file: 'assets/audio/zombie-attacking-2.mp3' },
  { key: 'sfx-zombie-attacking-2', file: 'assets/audio/zombie-attacking-3.mp3' },
  { key: 'sfx-zombie-attacking-3', file: 'assets/audio/zombie-attacking-4.mp3' },
];
