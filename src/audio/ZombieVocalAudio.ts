import type Phaser from 'phaser';
import type { Enemy } from '../game/combat/Enemy';
import { proximityGain } from './ProximityAudio';
import {
  ZOMBIE_ATTACKING_SOUNDS,
  ZOMBIE_IDLE_SOUNDS,
  type ZombieSoundEntry,
} from './zombieSoundManifest';

export type ZombieVocalMode = 'idle' | 'attacking';

/** Intensidade dos grunhidos — mesmo modelo de falloff que o fogo. */
export const ZOMBIE_VOCAL_LOUDNESS = 0.72;

type LoopSound = Phaser.Sound.BaseSound & {
  setVolume: (value: number) => unknown;
  isPlaying: boolean;
  stop: () => unknown;
  destroy: () => unknown;
  once: (event: string, fn: () => void) => unknown;
};

type ZombieSlot = {
  mode: ZombieVocalMode;
  audioKey: string;
  loudness: number;
  sound: LoopSound | null;
  /** Segundos até poder tocar outro grunhido (só quando o anterior terminou). */
  waitSec: number;
};

export function enemyVocalMode(enemy: {
  hunting: boolean;
  alerted: boolean;
}): ZombieVocalMode {
  return enemy.hunting || enemy.alerted ? 'attacking' : 'idle';
}

export function pickStableZombieSound(
  entries: readonly ZombieSoundEntry[],
  enemyId: string,
): string | null {
  if (entries.length === 0) return null;
  let h = 2166136261;
  for (let i = 0; i < enemyId.length; i += 1) {
    h ^= enemyId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return entries[(h >>> 0) % entries.length]!.key;
}

function loudnessForMode(mode: ZombieVocalMode): number {
  return mode === 'attacking'
    ? ZOMBIE_VOCAL_LOUDNESS * 1.08
    : ZOMBIE_VOCAL_LOUDNESS;
}

function entriesForMode(mode: ZombieVocalMode): readonly ZombieSoundEntry[] {
  return mode === 'attacking' ? ZOMBIE_ATTACKING_SOUNDS : ZOMBIE_IDLE_SOUNDS;
}

function playbackRate(enemyId: string): number {
  return 0.92 + ((enemyId.charCodeAt(0) ?? 0) % 7) * 0.02;
}

export function preloadZombieVocals(scene: Phaser.Scene): void {
  for (const entry of [...ZOMBIE_IDLE_SOUNDS, ...ZOMBIE_ATTACKING_SOUNDS]) {
    scene.load.audio(entry.key, entry.file);
  }
}

/**
 * Um slot de áudio por zumbi — volume por proximidade; para ao morrer ou sair do alcance.
 */
export class ZombieVocalAudio {
  private readonly scene: Phaser.Scene;
  private readonly slots = new Map<string, ZombieSlot>();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  get enabled(): boolean {
    return ZOMBIE_IDLE_SOUNDS.length > 0 || ZOMBIE_ATTACKING_SOUNDS.length > 0;
  }

  /** Actualiza vocais de todos os zumbis vivos (chamar uma vez por frame). */
  update(
    enemies: readonly Enemy[],
    listenerX: number,
    listenerY: number,
    dtSec: number,
  ): void {
    if (!this.enabled) return;

    const aliveIds = new Set<string>();
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      aliveIds.add(enemy.id);
      this.tickEnemy(enemy, listenerX, listenerY, dtSec);
    }

    for (const id of this.slots.keys()) {
      if (!aliveIds.has(id)) this.release(id);
    }
  }

  release(enemyId: string): void {
    const slot = this.slots.get(enemyId);
    if (!slot) return;
    this.stopSlotSound(slot);
    this.slots.delete(enemyId);
  }

  clear(): void {
    for (const id of [...this.slots.keys()]) {
      this.release(id);
    }
  }

  destroy(): void {
    this.clear();
  }

  private tickEnemy(
    enemy: Enemy,
    listenerX: number,
    listenerY: number,
    dtSec: number,
  ): void {
    const mode = enemyVocalMode(enemy);
    let slot = this.slots.get(enemy.id);

    if (!slot) {
      slot = this.createSlot(enemy.id, mode);
      this.slots.set(enemy.id, slot);
    } else if (slot.mode !== mode) {
      this.stopSlotSound(slot);
      slot.mode = mode;
      slot.audioKey = pickStableZombieSound(entriesForMode(mode), enemy.id)!;
      slot.loudness = loudnessForMode(mode);
      slot.waitSec = mode === 'attacking' ? 0.15 : 0.7;
    }

    const dist = Math.hypot(enemy.x - listenerX, enemy.y - listenerY);
    const gain = proximityGain(dist, slot.loudness);

    if (slot.sound?.isPlaying) {
      if (gain <= 0.001) {
        this.stopSlotSound(slot);
      } else {
        slot.sound.setVolume(Math.min(1, gain));
      }
    }

    slot.waitSec -= dtSec;
    if (slot.waitSec > 0 || slot.sound?.isPlaying) return;
    if (gain <= 0.001) {
      slot.waitSec = 0.35;
      return;
    }
    if (!slot.audioKey || !this.scene.cache.audio.exists(slot.audioKey)) return;

    const sound = this.scene.sound.add(slot.audioKey, {
      loop: false,
      volume: Math.min(1, gain),
      rate: playbackRate(enemy.id),
    }) as LoopSound;

    slot.sound = sound;
    sound.play();

    sound.once('complete', () => {
      if (slot.sound !== sound) return;
      slot.sound = null;
      sound.destroy();
    });

    slot.waitSec =
      mode === 'attacking'
        ? 1.1 + Math.random() * 1.6
        : 3.5 + Math.random() * 4.5;
  }

  private createSlot(enemyId: string, mode: ZombieVocalMode): ZombieSlot {
    const audioKey = pickStableZombieSound(entriesForMode(mode), enemyId) ?? '';
    return {
      mode,
      audioKey,
      loudness: loudnessForMode(mode),
      sound: null,
      waitSec: (enemyId.charCodeAt(0) % 10) * 0.35 + Math.random() * 2.5,
    };
  }

  private stopSlotSound(slot: ZombieSlot): void {
    const sound = slot.sound;
    if (!sound) return;
    slot.sound = null;
    if (sound.isPlaying) sound.stop();
    sound.destroy();
  }
}
