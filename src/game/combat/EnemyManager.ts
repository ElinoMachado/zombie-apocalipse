import Phaser from 'phaser';
import type { City } from '../../world/model/types';
import { Rng } from '../../world/rng/Rng';
import type { WorldCollision } from '../WorldCollision';
import type { ZombieVocalAudio } from '../../audio/ZombieVocalAudio';
import {
  centerDistanceNorm,
  enemyDamageRange,
  enemyHpForProximity,
  proximityFromCenter,
} from './cityThreat';
import { EnemySpatialGrid } from './EnemySpatialGrid';
import { planEnemySpawns } from './planEnemySpawns';
import { Enemy } from './Enemy';
import { ZOMBIE_VISION_OVERLAY_MAX_DRAW_DIST } from './ZombieVisionOverlay';
import { CorpseIndex, MAX_CORPSE_EATERS, type CorpseSite } from './CorpseIndex';
import type { ZombieEatingAudio } from '../../audio/ZombieEatingAudio';

/** Raio (px) para IA completa (movimento, pathfind, wander). */
const AI_FULL_RADIUS = 640;
/** Além disto, inimigos idle ficam dormentes até o jogador aproximar-se. */
const AI_WAKE_RADIUS = 1280;
/** Margem (px) além do viewport para criar sprites. */
const VISUAL_MARGIN = 180;

/**
 * Spawna inimigos pelo mapa: hordas fortes no centro, fracos e esparsos na periferia.
 */
export class EnemyManager {
  private enemies: Enemy[] = [];
  private nextId = 1;
  private readonly spatial = new EnemySpatialGrid(128);
  private huntingCountCached = 0;
  /** Distância para contagiar caça a vizinhos. */
  private readonly huntSpreadPx = 130;
  private corpseIndex: CorpseIndex | null = null;
  private tileSize = 32;
  hordeActive = false;

  get all(): readonly Enemy[] {
    return this.enemies;
  }

  get alive(): Enemy[] {
    return this.enemies.filter((e) => e.alive);
  }

  get huntingCount(): number {
    return this.huntingCountCached;
  }

  prepareFrame(): void {
    this.spatial.rebuild(this.enemies);
  }

  spawnForCity(
    scene: Phaser.Scene,
    city: City,
    collision: WorldCollision,
    playerSpawnX?: number,
    playerSpawnY?: number,
    vocals: ZombieVocalAudio | null = null,
  ): void {
    this.clear();
    vocals?.clear();
    this.corpseIndex = CorpseIndex.fromCity(city);
    this.tileSize = city.tileSize;
    const rng = new Rng(city.seed).fork('enemies');
    const planned = planEnemySpawns(
      city,
      collision,
      rng,
      playerSpawnX,
      playerSpawnY,
    );
    for (const s of planned) {
      const id = `e${this.nextId++}`;
      this.enemies.push(
        new Enemy(scene, id, s.x, s.y, {
          maxHp: s.maxHp,
          damageMin: s.damageMin,
          damageMax: s.damageMax,
          proximity: s.proximity,
        }),
      );
    }
  }

  /**
   * @deprecated O spawn principal já agrupa perto de loot — mantido vazio.
   */
  spawnLootGuards(
    _scene: Phaser.Scene,
    _city: City,
    _collision: WorldCollision,
  ): number {
    return 0;
  }

  private tooClose(x: number, y: number, minSep: number): boolean {
    let blocked = false;
    this.spatial.forEachInRadius(x, y, minSep, () => {
      blocked = true;
    });
    return blocked;
  }

  /**
   * Atrai o zumbi vivo mais próximo que ainda não está a caçar o jogador.
   */
  alertNearestFromNoise(playerX: number, playerY: number): boolean {
    const hit = this.spatial.findNearest(
      playerX,
      playerY,
      AI_WAKE_RADIUS,
      (e) => e.alive && !e.hunting,
    );
    if (!hit) return false;
    hit.enemy.alerted = true;
    hit.enemy.startHunt();
    hit.enemy.ensureVisual();
    return true;
  }

  /**
   * Spawna elite atraído pelo barulho — fora da visão + margem.
   */
  spawnFromNoise(
    scene: Phaser.Scene,
    city: City,
    collision: WorldCollision,
    playerX: number,
    playerY: number,
    count: number,
    elite: boolean,
    visionOuterPx: number,
  ): number {
    const ts = city.tileSize;
    if (!elite || count <= 0) return 0;

    let placed = 0;
    const want = 1;
    this.spatial.rebuild(this.enemies);

    const minDist = Math.max(visionOuterPx + ts * 3, ts * 8);
    const maxDist = minDist + ts * 10;

    for (let n = 0; n < want; n += 1) {
      let spawned = false;
      for (let attempt = 0; attempt < 48 && !spawned; attempt += 1) {
        const ang = Math.random() * Math.PI * 2;
        const dist = minDist + Math.random() * (maxDist - minDist);
        const x = playerX + Math.cos(ang) * dist;
        const y = playerY + Math.sin(ang) * dist;
        if (
          x < ts ||
          y < ts ||
          x > city.grid.w * ts - ts ||
          y > city.grid.h * ts - ts
        ) {
          continue;
        }
        if (collision.hits({ x, y, radius: 10 })) continue;
        if (this.tooClose(x, y, ts * 1.2)) continue;

        const tx = x / ts;
        const ty = y / ts;
        const distN = centerDistanceNorm(
          tx,
          ty,
          city.center.x,
          city.center.y,
          city.grid.w,
          city.grid.h,
        );
        const prox = proximityFromCenter(distN);
        const dmg = enemyDamageRange(prox);
        const hp = enemyHpForProximity(prox);
        const mult = elite ? 4 : 1;
        const id = `e${this.nextId++}`;
        const enemy = new Enemy(scene, id, x, y, {
          maxHp: Math.max(1, Math.round(hp * mult)),
          damageMin: Math.max(1, Math.round(dmg.min * mult)),
          damageMax: Math.max(1, Math.round(dmg.max * mult)),
          proximity: prox,
          elite,
          alerted: true,
        });
        enemy.ensureVisual();
        this.enemies.push(enemy);
        placed += 1;
        spawned = true;
      }
    }
    return placed;
  }

  private canAcceptCorpseEater(corpseId: string): boolean {
    let n = 0;
    for (const e of this.enemies) {
      if (e.alive && e.isEating && e.targetCorpseId === corpseId) n += 1;
    }
    return n < MAX_CORPSE_EATERS;
  }

  /** Cadáver de zumbi derrotado — só loot; não entra no índice de alimentação. */
  finalizeZombieCorpse(enemy: Enemy): CorpseSite | null {
    if (enemy.alive) return null;
    const corpse: CorpseSite = {
      id: `zombie-corpse-${enemy.id}`,
      x: enemy.x,
      y: enemy.y,
    };
    const idx = this.enemies.indexOf(enemy);
    if (idx >= 0) this.enemies.splice(idx, 1);
    enemy.destroy();
    return corpse;
  }

  /** @deprecated Use {@link finalizeZombieCorpse}. */
  registerZombieCorpse(enemy: Enemy): CorpseSite | null {
    return this.finalizeZombieCorpse(enemy);
  }

  updateAI(
    deltaMs: number,
    playerX: number,
    playerY: number,
    playerRadius: number,
    worldW: number,
    worldH: number,
    collision: WorldCollision,
    onPlayerHit: (
      damage: number,
      atX: number,
      atY: number,
      critical: boolean,
    ) => void,
    playerStealthed = false,
    vocals: ZombieVocalAudio | null = null,
    eatingAudio: ZombieEatingAudio | null = null,
    camera: Phaser.Cameras.Scene2D.Camera | null = null,
  ): void {
    const dt = deltaMs / 1000;
    this.prepareFrame();
    this.syncVisuals(camera, playerX, playerY);

    const beforeHunt = new Set<string>();
    for (const e of this.enemies) {
      if (e.alive && e.hunting) beforeHunt.add(e.id);
    }

    const fullR2 = AI_FULL_RADIUS * AI_FULL_RADIUS;
    const wakeR2 = AI_WAKE_RADIUS * AI_WAKE_RADIUS;

    for (const e of this.enemies) {
      e.syncVisibility();
      if (!e.alive) continue;

      const dx = e.x - playerX;
      const dy = e.y - playerY;
      const d2 = dx * dx + dy * dy;
      const active = e.hunting || e.alerted;

      if (!active && d2 > wakeR2) continue;

      if (!active && d2 > fullR2) {
        const vr = e.visionRadius + 48;
        if (d2 <= vr * vr && e.canSee(playerX, playerY, playerStealthed, collision)) {
          e.startHunt();
          e.ensureVisual();
        }
        continue;
      }

      const hit = e.updateAI(
        deltaMs,
        playerX,
        playerY,
        playerRadius,
        worldW,
        worldH,
        collision,
        playerStealthed,
        this.corpseIndex,
        this.tileSize,
        (corpseId) => this.canAcceptCorpseEater(corpseId),
      );
      if (hit && hit.damage > 0) {
        onPlayerHit(hit.damage, playerX, playerY, hit.critical);
      }
    }

    vocals?.update(this.enemies, playerX, playerY, dt);
    eatingAudio?.update(this.enemies, playerX, playerY);

    for (const e of this.enemies) {
      if (!e.alive || !e.hunting) continue;
      const wasHunting = beforeHunt.has(e.id);
      if (!wasHunting) {
        this.spreadHuntFrom(e, 1);
      } else if (Math.random() < 0.35 * dt) {
        this.spreadHuntFrom(e, 0.55);
      }
    }

    let hunters = 0;
    for (const e of this.enemies) {
      if (e.alive && e.hunting) hunters += 1;
    }
    this.huntingCountCached = hunters;
    this.hordeActive = hunters >= 5;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.setHorde(this.hordeActive && e.hunting);
    }
  }

  private syncVisuals(
    camera: Phaser.Cameras.Scene2D.Camera | null,
    playerX: number,
    playerY: number,
  ): void {
    const halfW = camera ? camera.width / (2 * camera.zoom) : AI_FULL_RADIUS;
    const halfH = camera ? camera.height / (2 * camera.zoom) : AI_FULL_RADIUS;
    const viewportR = Math.hypot(halfW, halfH) + VISUAL_MARGIN;

    for (const e of this.enemies) {
      if (!e.alive) {
        if (e.hasVisual) e.releaseVisual();
        continue;
      }

      const dx = e.x - playerX;
      const dy = e.y - playerY;
      const dist2 = dx * dx + dy * dy;
      // Alinhar com ZombieVisionOverlay: se o cone aparece, o corpo também deve.
      const coneR = ZOMBIE_VISION_OVERLAY_MAX_DRAW_DIST + e.visionRadius;
      const keepR = Math.max(viewportR, coneR);

      const keep =
        e.hunting ||
        e.alerted ||
        e.isEating ||
        e.isLuredByCorpse ||
        dist2 <= keepR * keepR;

      if (keep) e.ensureVisual();
      else if (e.hasVisual) e.releaseVisual();
    }
  }

  /** Propaga caça a zumbis próximos (movimento / gritos). */
  private spreadHuntFrom(source: Enemy, chance: number): void {
    this.spatial.forEachInRadius(
      source.x,
      source.y,
      this.huntSpreadPx,
      (e) => {
        if (!e.alive || e.hunting || e === source) return;
        if (Math.random() <= chance) {
          e.startHunt();
          e.ensureVisual();
        }
      },
    );
  }

  /** Primeiro inimigo vivo cuja hitbox intersecta o ponto (com raio). */
  hitTestPoint(x: number, y: number, radius = 0): Enemy | null {
    let best: Enemy | null = null;
    let bestD = Infinity;
    const scanR = Math.max(radius + 24, 48);
    this.spatial.forEachInRadius(x, y, scanR, (e) => {
      if (!e.alive) return;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d <= e.radius + radius && d < bestD) {
        best = e;
        bestD = d;
      }
    });
    return best;
  }

  /** Inimigos vivos dentro de um arco (slash). */
  hitTestSlash(
    ox: number,
    oy: number,
    aimAngle: number,
    range: number,
    halfAngle: number,
  ): Enemy[] {
    const hit: Enemy[] = [];
    this.spatial.forEachInRadius(ox, oy, range + 20, (e) => {
      if (!e.alive) return;
      const dx = e.x - ox;
      const dy = e.y - oy;
      const dist = Math.hypot(dx, dy);
      if (dist > range + e.radius) return;
      if (dist < 1) {
        hit.push(e);
        return;
      }
      const ang = Math.atan2(dy, dx);
      let delta = ang - aimAngle;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      if (Math.abs(delta) <= halfAngle) hit.push(e);
    });
    return hit;
  }

  clear(): void {
    for (const e of this.enemies) e.destroy();
    this.enemies = [];
    this.hordeActive = false;
    this.huntingCountCached = 0;
    this.corpseIndex = null;
    this.spatial.rebuild([]);
  }
}
