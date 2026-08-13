import Phaser from 'phaser';
import type { WorldCollision } from '../WorldCollision';
import type { Enemy } from './Enemy';

/** Passos angulares ao desenhar o cone ocluso (mais = mais suave). */
const CONE_RAY_STEPS = 22;

/** Distância máxima jogador→zumbi (px) para desenhar o cone (antes de +visionRadius). */
export const ZOMBIE_VISION_OVERLAY_MAX_DRAW_DIST = 420;

/**
 * Cones de visão 90° dos zumbis — cortados por paredes / bodyblock.
 * Só visíveis enquanto o zumbi ainda não identificou o jogador; ao caçar, o cone
 * some e volta quando o jogador despista (giveUpHunt). A comer, mantém metade
 * (raio interno — como stealth). Em stealth a zona externa fica acinzentada.
 */
export class ZombieVisionOverlay {
  private readonly gfx: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.gfx = scene.add.graphics();
    // Acima dos zumbis (55), abaixo da névoa (62).
    this.gfx.setDepth(56);
  }

  /**
   * Desenha o cone (interno + externo) dos zumbis vivos perto do jogador.
   */
  sync(
    enemies: readonly Enemy[],
    playerX: number,
    playerY: number,
    playerStealthed: boolean,
    collision: WorldCollision | null,
    maxDrawDist = ZOMBIE_VISION_OVERLAY_MAX_DRAW_DIST,
  ): void {
    this.gfx.clear();

    for (const e of enemies) {
      if (!e.alive || !e.showVisionCone) continue;
      const d = Math.hypot(e.x - playerX, e.y - playerY);
      if (d > maxDrawDist + e.visionRadius) continue;

      const rOuter = e.visionRadius;
      const rInner = e.visionInnerRadius;
      const half = e.visionHalfAngle;
      const a0 = e.facing - half;
      const a1 = e.facing + half;

      if (e.visionConeInnerOnly) {
        // Comendo: só metade interna (como detecção em stealth).
        this.gfx.fillStyle(0xff1744, 0.14);
        this.gfx.lineStyle(1.5, 0xff5252, 0.6);
        this.drawOccludedSector(e.x, e.y, rInner, a0, a1, collision);
        continue;
      }

      // Zona externa (anel do cone)
      if (playerStealthed) {
        this.gfx.fillStyle(0x6e7681, 0.14);
        this.gfx.lineStyle(1.25, 0x8b949e, 0.45);
      } else {
        this.gfx.fillStyle(0xff1744, 0.07);
        this.gfx.lineStyle(1.25, 0xff5252, 0.4);
      }
      this.drawOccludedSector(e.x, e.y, rOuter, a0, a1, collision);

      // Zona interna (sempre activa / mais intensa)
      this.gfx.fillStyle(0xff1744, 0.14);
      this.gfx.lineStyle(1.5, 0xff5252, 0.6);
      this.drawOccludedSector(e.x, e.y, rInner, a0, a1, collision);
    }
  }

  /** Sector em leque parado nos sólidos (paredes, árvores bloqueantes). */
  private drawOccludedSector(
    x: number,
    y: number,
    r: number,
    a0: number,
    a1: number,
    collision: WorldCollision | null,
  ): void {
    const span = a1 - a0;
    const steps = Math.max(6, Math.ceil((Math.abs(span) / Math.PI) * CONE_RAY_STEPS));

    this.gfx.beginPath();
    this.gfx.moveTo(x, y);

    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const ang = a0 + span * t;
      const cos = Math.cos(ang);
      const sin = Math.sin(ang);
      let dist = r;
      if (collision) {
        dist = collision.raycastDistance(x, y, cos, sin, r, 3);
      }
      this.gfx.lineTo(x + cos * dist, y + sin * dist);
    }

    this.gfx.closePath();
    this.gfx.fillPath();
    this.gfx.strokePath();
  }

  destroy(): void {
    this.gfx.destroy();
  }
}
