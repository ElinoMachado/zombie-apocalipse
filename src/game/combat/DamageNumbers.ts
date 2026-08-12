import Phaser from 'phaser';

interface Floater {
  text: Phaser.GameObjects.Text;
  life: number;
  vy: number;
}

/** Números de dano flutuantes no mundo. */
export class DamageNumbers {
  private readonly scene: Phaser.Scene;
  private items: Floater[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Dano causado a inimigos (amarelo/branco). */
  showOutgoing(x: number, y: number, amount: number): void {
    this.spawn(x, y - 8, String(amount), '#ffe082', 14);
  }

  /** Backstab / crítico. */
  showCritical(x: number, y: number, amount: number): void {
    this.spawn(x, y - 12, `CRIT ${amount}`, '#ffd700', 17);
  }

  /** Disparo falhou a precisão. */
  showMiss(x: number, y: number): void {
    this.spawn(x, y - 10, 'MISS', '#8b949e', 15);
  }

  /** Acerto bloqueado (dano reduzido). */
  showBlocked(x: number, y: number, amount: number): void {
    this.spawn(x, y - 10, `BLOCK ${amount}`, '#79c0ff', 14);
  }

  /** Dano recebido pelo jogador (vermelho). */
  showIncoming(x: number, y: number, amount: number): void {
    this.spawn(x, y - 10, `-${amount}`, '#ff6b6b', 16);
  }

  private spawn(
    x: number,
    y: number,
    label: string,
    color: string,
    size: number,
  ): void {
    const text = this.scene.add
      .text(x, y, label, {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: `${size}px`,
        fontStyle: 'bold',
        color,
        stroke: '#0d1117',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1)
      .setDepth(75);
    this.items.push({
      text,
      life: 0.85,
      vy: -28 - Math.random() * 12,
    });
  }

  update(deltaMs: number): void {
    const dt = deltaMs / 1000;
    for (let i = this.items.length - 1; i >= 0; i -= 1) {
      const f = this.items[i]!;
      f.life -= dt;
      f.text.y += f.vy * dt;
      f.text.setAlpha(Math.max(0, f.life / 0.85));
      if (f.life <= 0) {
        f.text.destroy();
        this.items.splice(i, 1);
      }
    }
  }

  destroy(): void {
    for (const f of this.items) f.text.destroy();
    this.items = [];
  }
}
