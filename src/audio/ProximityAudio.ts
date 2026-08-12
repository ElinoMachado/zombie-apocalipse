/**
 * Áudio por proximidade: volume cai com a distância até 0 no raio.
 * O raio de audição escala com a `loudness` da fonte.
 */

import type Phaser from 'phaser';

export interface ProximityEmitterSpec {
  id: string;
  /** Chave Phaser do áudio (loop). */
  audioKey: string;
  /** Posição mundo (px). */
  x: number;
  y: number;
  /**
   * Intensidade da fonte (0–1).
   * Define volume máximo e raio = BASE_RADIUS_PX * loudness.
   */
  loudness: number;
}

/** Raio de audição em px quando loudness = 1. */
export const PROXIMITY_BASE_RADIUS_PX = 320;

export function hearingRadius(loudness: number): number {
  return PROXIMITY_BASE_RADIUS_PX * Math.max(0.05, Math.min(1, loudness));
}

/** Atenuação suave: 1 no centro, 0 no limite do raio. */
export function proximityGain(
  distPx: number,
  loudness: number,
): number {
  const r = hearingRadius(loudness);
  if (distPx >= r) return 0;
  const t = 1 - distPx / r;
  // quadrático — cai mais depressa perto do limite
  return loudness * t * t;
}

type LoopSound = Phaser.Sound.BaseSound & {
  setVolume: (value: number) => unknown;
};

type ActiveSource = {
  spec: ProximityEmitterSpec;
  sound: LoopSound | null;
};

/**
 * Gere várias fontes em loop; cada frame actualiza volume pela distância ao listener.
 */
export class ProximityAudio {
  private readonly scene: Phaser.Scene;
  private sources = new Map<string, ActiveSource>();
  private muted = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Substitui o conjunto de emissores (ex.: ao gerar cidade). */
  setEmitters(specs: ProximityEmitterSpec[]): void {
    const nextIds = new Set(specs.map((s) => s.id));
    for (const [id, src] of this.sources) {
      if (!nextIds.has(id)) {
        src.sound?.stop();
        src.sound?.destroy();
        this.sources.delete(id);
      }
    }
    for (const spec of specs) {
      const existing = this.sources.get(spec.id);
      if (existing) {
        existing.spec = spec;
      } else {
        this.sources.set(spec.id, { spec, sound: null });
      }
    }
  }

  clear(): void {
    for (const src of this.sources.values()) {
      src.sound?.stop();
      src.sound?.destroy();
    }
    this.sources.clear();
  }

  /** Actualiza volumes / start-stop conforme distância ao jogador. */
  update(listenerX: number, listenerY: number): void {
    if (this.muted) {
      for (const src of this.sources.values()) {
        if (src.sound?.isPlaying) src.sound.setVolume(0);
      }
      return;
    }

    for (const src of this.sources.values()) {
      const { spec } = src;
      const dist = Math.hypot(listenerX - spec.x, listenerY - spec.y);
      const gain = proximityGain(dist, spec.loudness);

      if (gain <= 0.001) {
        if (src.sound?.isPlaying) {
          src.sound.stop();
        }
        continue;
      }

      if (!src.sound) {
        if (!this.scene.cache.audio.exists(spec.audioKey)) continue;
        src.sound = this.scene.sound.add(spec.audioKey, {
          loop: true,
          volume: 0,
        }) as LoopSound;
      }

      if (!src.sound.isPlaying) {
        src.sound.play();
      }
      src.sound.setVolume(Math.min(1, gain));
    }
  }

  destroy(): void {
    this.clear();
  }
}
