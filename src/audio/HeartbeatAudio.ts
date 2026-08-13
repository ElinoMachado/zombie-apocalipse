import type Phaser from 'phaser';
import {
  HEARTBEAT_ATTACKED_SEC,
  HEARTBEAT_TIER_SEC,
  hpRatio,
  pickHeartbeatTier,
  type HeartbeatTier,
} from '../game/lowHealthStress';

export const HeartbeatKeys = {
  attacked: 'sfx-heartbeat-attacked',
  tier75: 'sfx-heartbeat-75',
  tier50: 'sfx-heartbeat-50',
  tier30: 'sfx-heartbeat-30',
} as const;

const TIER_KEY: Record<HeartbeatTier, string> = {
  75: HeartbeatKeys.tier75,
  50: HeartbeatKeys.tier50,
  30: HeartbeatKeys.tier30,
};

export function preloadHeartbeatAudio(scene: Phaser.Scene): void {
  scene.load.audio(HeartbeatKeys.attacked, 'assets/audio/heartbeat_Attacked.mp3');
  scene.load.audio(HeartbeatKeys.tier75, 'assets/audio/heartbeat_75.mp3');
  scene.load.audio(HeartbeatKeys.tier50, 'assets/audio/heartbeat_50.mp3');
  scene.load.audio(HeartbeatKeys.tier30, 'assets/audio/heartbeat_30.mp3');
}

type Phase = 'idle' | 'attacked' | 'tier';

/**
 * Heartbeat ao receber dano: getAttacked (3 s) → faixa por % HP (75/50/30).
 * Nova ferida reinicia o ataque e adia a faixa numérica.
 */
export class HeartbeatAudio {
  private readonly scene: Phaser.Scene;
  private phase: Phase = 'idle';
  private phaseLeftSec = 0;
  private activeSound: Phaser.Sound.BaseSound | null = null;
  private muted = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) this.reset();
  }

  /** Chamado sempre que o jogador perde HP (após aplicar dano). */
  onDamage(hp: number, _maxHp: number): void {
    if (this.muted || hp <= 0) return;
    this.stopActiveSound();
    this.phase = 'attacked';
    this.phaseLeftSec = HEARTBEAT_ATTACKED_SEC;
    this.playKey(HeartbeatKeys.attacked, 0.72);
  }

  update(deltaMs: number, hp: number, maxHp: number): void {
    if (this.phase === 'idle' || this.muted) return;

    const dt = deltaMs / 1000;
    this.phaseLeftSec -= dt;

    if (this.phaseLeftSec > 0) return;

    if (this.phase === 'attacked') {
      this.stopActiveSound();
      const tier = pickHeartbeatTier(hpRatio(hp, maxHp));
      if (tier == null || hp <= 0) {
        this.phase = 'idle';
        return;
      }
      this.phase = 'tier';
      this.phaseLeftSec = HEARTBEAT_TIER_SEC[tier];
      this.playKey(TIER_KEY[tier], 0.68);
      return;
    }

    if (this.phase === 'tier') {
      this.stopActiveSound();
      this.phase = 'idle';
    }
  }

  reset(): void {
    this.stopActiveSound();
    this.phase = 'idle';
    this.phaseLeftSec = 0;
  }

  destroy(): void {
    this.reset();
  }

  private playKey(key: string, volume: number): void {
    if (!this.scene.cache.audio.exists(key)) return;
    this.activeSound = this.scene.sound.add(key, {
      loop: true,
      volume,
    });
    this.activeSound.play();
  }

  private stopActiveSound(): void {
    this.activeSound?.stop();
    this.activeSound?.destroy();
    this.activeSound = null;
  }
}
