import type Phaser from 'phaser';
import type { City } from '../world/model/types';
import {
  ProximityAudio,
  type ProximityEmitterSpec,
} from './ProximityAudio';
import { preloadZombieVocals, ZombieVocalAudio } from './ZombieVocalAudio';
import { preloadZombieEating, ZombieEatingAudio } from './ZombieEatingAudio';
import { HeartbeatAudio, preloadHeartbeatAudio } from './HeartbeatAudio';

export const AudioKeys = {
  musicSuspense: 'music-suspense',
  musicSuspicious: 'music-suspicious',
  fireCrackling: 'sfx-fire-crackling',
  pistolShot: 'sfx-pistol-shot',
  pistolReload: 'sfx-pistol-reload',
  gunDryFire: 'sfx-gun-dry-fire',
  knifeHit: [
    'sfx-knife-hit-0',
    'sfx-knife-hit-1',
    'sfx-knife-hit-2',
    'sfx-knife-hit-3',
  ],
  knifeMiss: 'sfx-knife-miss',
  knifeNoHit: 'sfx-knife-no-hit',
  lootSearch: 'sfx-loot-search',
  footstep: [
    'sfx-footstep-0',
    'sfx-footstep-1',
    'sfx-footstep-2',
    'sfx-footstep-3',
    'sfx-footstep-4',
  ],
} as const;

/** Som de disparo por id de arma (extensível). */
const WEAPON_FIRE_KEYS: Record<string, string> = {
  pistol: AudioKeys.pistolShot,
  pistol_9mm: AudioKeys.pistolShot,
};

/** Loudness tipica de um foco de fogo (define raio de audição). */
export const FIRE_LOUDNESS = 0.75;

/** Preload de música, fogo, combate e passos. */
export function preloadAudio(scene: Phaser.Scene): void {
  scene.load.audio(AudioKeys.musicSuspense, 'assets/audio/suspense.ogg');
  scene.load.audio(AudioKeys.musicSuspicious, 'assets/audio/sus_corner.ogg');
  scene.load.audio(
    AudioKeys.fireCrackling,
    'assets/audio/fire-campfire.ogg',
  );
  scene.load.audio(AudioKeys.pistolShot, 'assets/audio/pistol-shot.mp3');
  scene.load.audio(AudioKeys.pistolReload, 'assets/audio/pistol-reload.wav');
  scene.load.audio(AudioKeys.gunDryFire, 'assets/audio/gun-dry-fire.wav');
  for (let i = 0; i < AudioKeys.knifeHit.length; i++) {
    scene.load.audio(
      AudioKeys.knifeHit[i]!,
      `assets/audio/knife-hit-${i + 1}.mp3`,
    );
  }
  scene.load.audio(AudioKeys.knifeMiss, 'assets/audio/knife-miss.mp3');
  scene.load.audio(AudioKeys.knifeNoHit, 'assets/audio/knife-no-hit.mp3');
  scene.load.audio(AudioKeys.lootSearch, 'assets/audio/loot-search.wav');
  for (let i = 0; i < AudioKeys.footstep.length; i++) {
    scene.load.audio(
      AudioKeys.footstep[i]!,
      `assets/audio/footstep0${i}.ogg`,
    );
  }
  preloadZombieVocals(scene);
  preloadZombieEating(scene);
  preloadHeartbeatAudio(scene);
}

/**
 * Música + passos + fontes de proximidade (fogo, etc.) + SFX de combate.
 */
export class GameAudio {
  private readonly scene: Phaser.Scene;
  private readonly proximity: ProximityAudio;
  readonly zombieVocals: ZombieVocalAudio;
  readonly zombieEating: ZombieEatingAudio;
  readonly heartbeat: HeartbeatAudio;
  private music: Phaser.Sound.BaseSound | null = null;
  private lootSearchSound: Phaser.Sound.BaseSound | null = null;
  private stepAcc = 0;
  private stepIndex = 0;
  private muted = false;

  /** Distância em px entre passos. */
  stepDistance = 22;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.proximity = new ProximityAudio(scene);
    this.zombieVocals = new ZombieVocalAudio(scene);
    this.zombieEating = new ZombieEatingAudio(scene);
    this.heartbeat = new HeartbeatAudio(scene);
  }

  /** Heartbeat + efeitos de ferida — chamar após aplicar dano ao jogador. */
  onPlayerDamage(hp: number, maxHp: number): void {
    if (this.muted) return;
    this.heartbeat.onDamage(hp, maxHp);
  }

  updateHeartbeat(deltaMs: number, hp: number, maxHp: number): void {
    this.heartbeat.update(deltaMs, hp, maxHp);
  }

  private playSfx(
    key: string,
    volume: number,
    rate = 1,
  ): void {
    if (this.muted) return;
    if (!this.scene.cache.audio.exists(key)) return;
    this.scene.sound.play(key, {
      volume,
      rate,
    });
  }

  /** Disparo — roteado por arma; só pistola por enquanto. */
  playWeaponFire(weaponId: string): void {
    const key = WEAPON_FIRE_KEYS[weaponId] ?? AudioKeys.pistolShot;
    this.playSfx(key, 0.5, 0.98 + Math.random() * 0.06);
  }

  /** @deprecated use playWeaponFire */
  playGunshot(): void {
    this.playWeaponFire('pistol');
  }

  /** Acertou inimigo ou objeto sólido — 1 de 4 variantes. */
  playKnifeHit(): void {
    const keys = AudioKeys.knifeHit;
    const key = keys[Math.floor(Math.random() * keys.length)]!;
    this.playSfx(key, 0.46, 0.96 + Math.random() * 0.08);
  }

  /** Inimigo na área mas rolagem falhou. */
  playKnifeMiss(): void {
    this.playSfx(AudioKeys.knifeMiss, 0.42, 0.98 + Math.random() * 0.06);
  }

  /** Golpe no ar — nada na área. */
  playKnifeNoHit(): void {
    this.playSfx(AudioKeys.knifeNoHit, 0.4, 0.94 + Math.random() * 0.1);
  }

  playDryFire(): void {
    this.playSfx(AudioKeys.gunDryFire, 0.55, 0.98 + Math.random() * 0.06);
  }

  playReload(weaponId: string): void {
    if (weaponId === 'pistol' || weaponId === 'pistol_9mm') {
      this.playSfx(AudioKeys.pistolReload, 0.44, 1);
      return;
    }
    this.playSfx(AudioKeys.pistolReload, 0.44, 1);
  }

  startLootSearch(): void {
    if (this.muted) return;
    this.stopLootSearch();
    if (!this.scene.cache.audio.exists(AudioKeys.lootSearch)) return;
    this.lootSearchSound = this.scene.sound.add(AudioKeys.lootSearch, {
      loop: true,
      volume: 0.34,
    });
    this.lootSearchSound.play();
  }

  stopLootSearch(): void {
    this.lootSearchSound?.stop();
    this.lootSearchSound?.destroy();
    this.lootSearchSound = null;
  }

  startMusic(): void {
    this.stopMusic();
    if (this.muted) return;
    const key = this.scene.cache.audio.exists(AudioKeys.musicSuspicious)
      ? AudioKeys.musicSuspicious
      : AudioKeys.musicSuspense;
    if (!this.scene.cache.audio.exists(key)) return;
    this.music = this.scene.sound.add(key, {
      loop: true,
      volume: 0.32,
    });
    this.music.play();
  }

  stopMusic(): void {
    this.music?.stop();
    this.music?.destroy();
    this.music = null;
  }

  /** Regista emissores do mapa (fogos, etc.) com áudio por proximidade. */
  bindWorldEmitters(city: City): void {
    const emitters: ProximityEmitterSpec[] = [];
    const ts = city.tileSize;
    for (const p of city.ambientProps) {
      if (p.kind !== 'burning_debris') continue;
      emitters.push({
        id: `fire:${p.id}`,
        audioKey: AudioKeys.fireCrackling,
        x: p.x * ts + ts / 2,
        y: p.y * ts + ts / 2,
        loudness: FIRE_LOUDNESS,
      });
    }
    this.proximity.setEmitters(emitters);
  }

  clearWorldEmitters(): void {
    this.proximity.clear();
  }

  /** Actualiza volumes das fontes pelo listener (jogador). */
  updateListener(worldX: number, worldY: number): void {
    this.proximity.update(worldX, worldY);
  }

  /** Acumula distância andada e dispara SFX. */
  onMove(distancePx: number): void {
    if (this.muted || distancePx <= 0) return;
    this.stepAcc += distancePx;
    while (this.stepAcc >= this.stepDistance) {
      this.stepAcc -= this.stepDistance;
      this.playFootstep();
    }
  }

  private playFootstep(): void {
    const keys = AudioKeys.footstep;
    const key = keys[this.stepIndex % keys.length]!;
    this.stepIndex += 1;
    if (!this.scene.cache.audio.exists(key)) return;
    this.scene.sound.play(key, {
      volume: 0.28 + Math.random() * 0.12,
      rate: 0.92 + Math.random() * 0.16,
    });
  }

  destroy(): void {
    this.stopLootSearch();
    this.stopMusic();
    this.heartbeat.reset();
    this.zombieEating.clear();
    this.zombieVocals.destroy();
    this.zombieEating.destroy();
    this.proximity.destroy();
  }
}
