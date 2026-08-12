import Phaser from 'phaser';
import type { City } from '../../world/model/types';
import type { WorldCollision } from '../WorldCollision';
import type { ZombieVocalAudio } from '../../audio/ZombieVocalAudio';
import {
  centerDistanceNorm,
  enemyDamageRange,
  enemyHpForProximity,
  enemySpacingPx,
  playerSpawnClearancePx,
  proximityFromCenter,
  spawnDensityWeight,
} from './cityThreat';
import { Enemy } from './Enemy';

/**
 * Spawna inimigos pelo mapa: hordas fortes no centro, fracos e esparsos na periferia.
 */
export class EnemyManager {
  private enemies: Enemy[] = [];
  private nextId = 1;
  /** Distância para contagiar caça a vizinhos. */
  private readonly huntSpreadPx = 130;
  hordeActive = false;

  get all(): readonly Enemy[] {
    return this.enemies;
  }

  get alive(): Enemy[] {
    return this.enemies.filter((e) => e.alive);
  }

  get huntingCount(): number {
    return this.enemies.filter((e) => e.alive && e.hunting).length;
  }

  /**
   * Spawna inimigos: a maioria junto a POIs de loot; o resto espalhado.
   * Força ainda escala com proximidade ao centro da cidade.
   */
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
    const ts = city.tileSize;
    const spawnClear =
      playerSpawnX != null && playerSpawnY != null
        ? playerSpawnClearancePx(ts)
        : null;
    const cx = city.center.x;
    const cy = city.center.y;
    const area = city.grid.w * city.grid.h;
    const targetCount = Math.min(220, Math.max(40, Math.floor(area / 900)));
    const pois = city.explorationPoints;
    /** Fração que nasce perto de loot (resto = mapa geral). */
    const lootBias = 0.8;

    const attempts = targetCount * 40;
    let placed = 0;

    for (let i = 0; i < attempts && placed < targetCount; i += 1) {
      let tx: number;
      let ty: number;

      if (pois.length > 0 && Math.random() < lootBias) {
        const poi = pois[Math.floor(Math.random() * pois.length)]!;
        const ang = Math.random() * Math.PI * 2;
        // Anel à volta do POI (não em cima da bolinha).
        const distTiles = 1.2 + Math.random() * 5.5;
        tx = poi.x + Math.cos(ang) * distTiles;
        ty = poi.y + Math.sin(ang) * distTiles;
      } else {
        tx = 2 + Math.random() * (city.grid.w - 4);
        ty = 2 + Math.random() * (city.grid.h - 4);
      }

      tx = Math.max(2, Math.min(city.grid.w - 3, tx));
      ty = Math.max(2, Math.min(city.grid.h - 3, ty));

      const distN = centerDistanceNorm(tx, ty, cx, cy, city.grid.w, city.grid.h);
      const prox = proximityFromCenter(distN);
      const density = spawnDensityWeight(prox);
      // Longe do centro: mais fácil rejeitar (mesmo perto de loot).
      if (Math.random() > Math.max(0.22, density)) continue;

      const x = tx * ts + ts / 2;
      const y = ty * ts + ts / 2;
      if (collision.hits({ x, y, radius: 8 })) continue;

      if (
        spawnClear != null &&
        playerSpawnX != null &&
        playerSpawnY != null &&
        this.tooCloseToPoint(x, y, playerSpawnX, playerSpawnY, spawnClear)
      ) {
        continue;
      }

      const minSep = enemySpacingPx(prox, ts);
      if (this.tooClose(x, y, minSep)) continue;

      const dmg = enemyDamageRange(prox);
      const hp = enemyHpForProximity(prox);
      const id = `e${this.nextId++}`;
      this.enemies.push(
        new Enemy(scene, id, x, y, {
          maxHp: hp,
          damageMin: dmg.min,
          damageMax: dmg.max,
          proximity: prox,
        }),
      );
      placed += 1;
    }

    if (spawnClear != null && playerSpawnX != null && playerSpawnY != null) {
      this.cullNearPoint(playerSpawnX, playerSpawnY, spawnClear);
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
    const min2 = minSep * minSep;
    for (const e of this.enemies) {
      const dx = e.x - x;
      const dy = e.y - y;
      if (dx * dx + dy * dy < min2) return true;
    }
    return false;
  }

  private tooCloseToPoint(
    x: number,
    y: number,
    px: number,
    py: number,
    minDist: number,
  ): boolean {
    const dx = x - px;
    const dy = y - py;
    return dx * dx + dy * dy < minDist * minDist;
  }

  /** Remove inimigos dentro de um raio (rede de segurança pós-spawn). */
  private cullNearPoint(px: number, py: number, radius: number): void {
    const r2 = radius * radius;
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const e = this.enemies[i]!;
      const dx = e.x - px;
      const dy = e.y - py;
      if (dx * dx + dy * dy < r2) {
        e.destroy();
        this.enemies.splice(i, 1);
      }
    }
  }

  /**
   * Atrai o zumbi vivo mais próximo que ainda não está a caçar o jogador.
   * Ignora zumbis já em combate para o barulho chamar reforços.
   * @returns true se havia um inimigo disponível para alertar.
   */
  alertNearestFromNoise(playerX: number, playerY: number): boolean {
    let nearest: Enemy | null = null;
    let nearestDist = Infinity;
    for (const e of this.enemies) {
      if (!e.alive || e.hunting) continue;
      const d = Math.hypot(e.x - playerX, e.y - playerY);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = e;
      }
    }
    if (!nearest) return false;
    nearest.alerted = true;
    nearest.startHunt();
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
        this.enemies.push(
          new Enemy(scene, id, x, y, {
            maxHp: Math.max(1, Math.round(hp * mult)),
            damageMin: Math.max(1, Math.round(dmg.min * mult)),
            damageMax: Math.max(1, Math.round(dmg.max * mult)),
            proximity: prox,
            elite,
            alerted: true,
          }),
        );
        placed += 1;
        spawned = true;
      }
    }
    return placed;
  }

  updateAI(
    deltaMs: number,
    playerX: number,
    playerY: number,
    playerRadius: number,
    worldW: number,
    worldH: number,
    collision: WorldCollision,
    onPlayerHit: (damage: number, atX: number, atY: number) => void,
    playerStealthed = false,
    vocals: ZombieVocalAudio | null = null,
  ): void {
    const dt = deltaMs / 1000;
    const beforeHunt = new Set(
      this.enemies.filter((e) => e.alive && e.hunting).map((e) => e.id),
    );

    for (const e of this.enemies) {
      e.syncVisibility();
      if (!e.alive) continue;
      const dmg = e.updateAI(
        deltaMs,
        playerX,
        playerY,
        playerRadius,
        worldW,
        worldH,
        collision,
        playerStealthed,
      );
      if (dmg > 0) onPlayerHit(dmg, playerX, playerY);
    }

    vocals?.update(this.enemies, playerX, playerY, dt);

    // Quem acabou de identificar → vizinhos podem juntar-se à caçada.
    for (const e of this.enemies) {
      if (!e.alive || !e.hunting) continue;
      const wasHunting = beforeHunt.has(e.id);
      if (!wasHunting) {
        this.spreadHuntFrom(e, 1);
      } else if (Math.random() < 0.35 * dt) {
        this.spreadHuntFrom(e, 0.55);
      }
    }

    const hunters = this.huntingCount;
    this.hordeActive = hunters >= 5;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.setHorde(this.hordeActive && e.hunting);
    }
  }

  /** Propaga caça a zumbis próximos (movimento / gritos). */
  private spreadHuntFrom(source: Enemy, chance: number): void {
    const r2 = this.huntSpreadPx * this.huntSpreadPx;
    for (const e of this.enemies) {
      if (!e.alive || e.hunting || e === source) continue;
      const dx = e.x - source.x;
      const dy = e.y - source.y;
      if (dx * dx + dy * dy > r2) continue;
      if (Math.random() <= chance) e.startHunt();
    }
  }

  /** Primeiro inimigo vivo cuja hitbox intersecta o ponto (com raio). */
  hitTestPoint(x: number, y: number, radius = 0): Enemy | null {
    let best: Enemy | null = null;
    let bestD = Infinity;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d <= e.radius + radius && d < bestD) {
        best = e;
        bestD = d;
      }
    }
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
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = e.x - ox;
      const dy = e.y - oy;
      const dist = Math.hypot(dx, dy);
      if (dist > range + e.radius) continue;
      if (dist < 1) {
        hit.push(e);
        continue;
      }
      const ang = Math.atan2(dy, dx);
      let delta = ang - aimAngle;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      if (Math.abs(delta) <= halfAngle) hit.push(e);
    }
    return hit;
  }

  clear(): void {
    for (const e of this.enemies) e.destroy();
    this.enemies = [];
    this.hordeActive = false;
  }
}
