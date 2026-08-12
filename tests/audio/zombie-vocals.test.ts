import { describe, expect, it } from 'vitest';
import {
  enemyVocalMode,
  pickStableZombieSound,
  ZOMBIE_VOCAL_LOUDNESS,
} from '../../src/audio/ZombieVocalAudio';
import { proximityGain } from '../../src/audio/ProximityAudio';
import {
  ZOMBIE_ATTACKING_SOUNDS,
  ZOMBIE_IDLE_SOUNDS,
} from '../../src/audio/zombieSoundManifest';

describe('zombie sound manifest', () => {
  it('uses unique cache keys per entry', () => {
    const keys = [
      ...ZOMBIE_IDLE_SOUNDS.map((e) => e.key),
      ...ZOMBIE_ATTACKING_SOUNDS.map((e) => e.key),
    ];
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('points assets under assets/audio/', () => {
    for (const e of [...ZOMBIE_IDLE_SOUNDS, ...ZOMBIE_ATTACKING_SOUNDS]) {
      expect(e.file.startsWith('assets/audio/')).toBe(true);
    }
  });

  it('loads idle and attacking clips', () => {
    expect(ZOMBIE_IDLE_SOUNDS.length).toBeGreaterThan(0);
    expect(ZOMBIE_ATTACKING_SOUNDS.length).toBeGreaterThan(0);
  });
});

describe('zombie vocal proximity', () => {
  it('is louder near the player than far away', () => {
    const near = proximityGain(40, ZOMBIE_VOCAL_LOUDNESS);
    const far = proximityGain(200, ZOMBIE_VOCAL_LOUDNESS);
    expect(near).toBeGreaterThan(far);
  });
});

describe('zombie vocal slots', () => {
  it('picks a stable clip per enemy id', () => {
    const a = pickStableZombieSound(ZOMBIE_IDLE_SOUNDS, 'e42');
    const b = pickStableZombieSound(ZOMBIE_IDLE_SOUNDS, 'e42');
    expect(a).toBe(b);
    expect(a).toBeTruthy();
  });

  it('derives mode from hunt state', () => {
    expect(enemyVocalMode({ hunting: false, alerted: false })).toBe('idle');
    expect(enemyVocalMode({ hunting: true, alerted: false })).toBe('attacking');
  });
});
