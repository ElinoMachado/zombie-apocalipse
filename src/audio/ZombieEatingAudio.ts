import type Phaser from 'phaser';
import type { Enemy } from '../game/combat/Enemy';
import { proximityGain } from './ProximityAudio';

export const ZOMBIE_EATING_KEY = 'sfx-zombie-eating';
export const ZOMBIE_EATING_LOUDNESS = 0.7;

type LoopSound = Phaser.Sound.BaseSound & {
  setVolume: (value: number) => unknown;
  isPlaying: boolean;
  stop: () => unknown;
  destroy: () => unknown;
};

export function preloadZombieEating(scene: Phaser.Scene): void {
  scene.load.audio(ZOMBIE_EATING_KEY, 'assets/audio/zombie_eating.mp3');
}

/**
 * Loop de mastigação por zumbi — volume por proximidade ao jogador.
 */
export class ZombieEatingAudio {
  private readonly scene: Phaser.Scene;
  private readonly loops = new Map<string, LoopSound>();
  private muted = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) this.clear();
  }

  update(
    enemies: readonly Enemy[],
    listenerX: number,
    listenerY: number,
  ): void {
    if (this.muted || !this.scene.cache.audio.exists(ZOMBIE_EATING_KEY)) {
      this.clear();
      return;
    }

    const active = new Set<string>();
    for (const enemy of enemies) {
      if (!enemy.alive || !enemy.isEating) continue;
      active.add(enemy.id);
      this.syncLoop(enemy, listenerX, listenerY);
    }

    for (const id of this.loops.keys()) {
      if (!active.has(id)) this.release(id);
    }
  }

  release(enemyId: string): void {
    const sound = this.loops.get(enemyId);
    if (!sound) return;
    this.loops.delete(enemyId);
    if (sound.isPlaying) sound.stop();
    sound.destroy();
  }

  clear(): void {
    for (const id of [...this.loops.keys()]) {
      this.release(id);
    }
  }

  destroy(): void {
    this.clear();
  }

  private syncLoop(
    enemy: Enemy,
    listenerX: number,
    listenerY: number,
  ): void {
    const dist = Math.hypot(enemy.x - listenerX, enemy.y - listenerY);
    const gain = proximityGain(dist, ZOMBIE_EATING_LOUDNESS);
    let sound = this.loops.get(enemy.id);

    if (gain <= 0.001) {
      if (sound) this.release(enemy.id);
      return;
    }

    if (!sound) {
      sound = this.scene.sound.add(ZOMBIE_EATING_KEY, {
        loop: true,
        volume: Math.min(1, gain),
      }) as LoopSound;
      this.loops.set(enemy.id, sound);
      sound.play();
      return;
    }

    if (!sound.isPlaying) sound.play();
    sound.setVolume(Math.min(1, gain));
  }
}
