import type Phaser from 'phaser';
import { carObbWorldCorners, type CarObbSolid } from '../assets/wreckedCars';

/** Desenha OBBs de carros para debug (/hit-boxes cars on). */
export class CarHitboxOverlay {
  private readonly gfx: Phaser.GameObjects.Graphics;
  private visible = false;

  constructor(scene: Phaser.Scene) {
    this.gfx = scene.add.graphics().setDepth(76);
    this.gfx.setVisible(false);
  }

  setVisible(on: boolean): void {
    this.visible = on;
    this.gfx.setVisible(on);
    if (!on) this.gfx.clear();
  }

  sync(obbs: readonly CarObbSolid[]): void {
    this.gfx.clear();
    if (!this.visible || obbs.length === 0) return;

    for (const o of obbs) {
      this.strokeObb(o);
    }
  }

  private strokeObb(obb: CarObbSolid): void {
    const corners = carObbWorldCorners(obb);

    this.gfx.lineStyle(2, 0xff5caa, 0.9);
    this.gfx.fillStyle(0xff5caa, 0.12);
    this.gfx.beginPath();
    for (let i = 0; i < corners.length; i += 1) {
      const { x, y } = corners[i]!;
      if (i === 0) this.gfx.moveTo(x, y);
      else this.gfx.lineTo(x, y);
    }
    this.gfx.closePath();
    this.gfx.fillPath();
    this.gfx.strokePath();
  }

  destroy(): void {
    this.gfx.destroy();
  }
}
