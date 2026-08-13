import { hpRatio, lowHealthStress } from '../game/lowHealthStress';

const CORNERS = ['tl', 'tr', 'bl', 'br'] as const;
type Corner = (typeof CORNERS)[number];

/** Overlay fullscreen — vigneta vermelha + veias nos cantos; pulsa ao levar dano. */
export class LowHealthVignetteHud {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private visible = false;
  private ratio = 1;
  private pulseSec = 0;
  private timeSec = 0;
  private readonly onResize = (): void => this.resize();

  constructor() {
    const host = document.getElementById('ui-root');
    if (!host) throw new Error('#ui-root não encontrado');

    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = [
      'position:absolute',
      'inset:0',
      'width:100%',
      'height:100%',
      'pointer-events:none',
      'z-index:1',
      'display:none',
    ].join(';');

    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D indisponível');
    this.ctx = ctx;

    host.prepend(this.canvas);
    window.addEventListener('resize', this.onResize);
    this.resize();
  }

  show(): void {
    this.visible = true;
    this.canvas.style.display = 'block';
    this.ratio = 1;
    this.pulseSec = 0;
    this.timeSec = 0;
    this.draw();
  }

  hide(): void {
    this.visible = false;
    this.canvas.style.display = 'none';
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  sync(hp: number, maxHp: number): void {
    this.ratio = hpRatio(hp, maxHp);
  }

  pulseOnDamage(): void {
    this.pulseSec = 0.55;
  }

  update(deltaMs: number): void {
    if (!this.visible) return;
    const dt = deltaMs / 1000;
    this.timeSec += dt;
    this.pulseSec = Math.max(0, this.pulseSec - dt);
    this.draw();
  }

  destroy(): void {
    window.removeEventListener('resize', this.onResize);
    this.canvas.remove();
  }

  private resize(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = Math.max(1, Math.floor(w * dpr));
    this.canvas.height = Math.max(1, Math.floor(h * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.visible) this.draw();
  }

  private draw(): void {
    const ctx = this.ctx;
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);

    const stress = lowHealthStress(this.ratio);
    const pulse = this.pulseSec > 0 ? Math.sin((0.55 - this.pulseSec) * 28) ** 2 : 0;
    const pulseAmt = pulse * (0.55 + stress * 0.45);

    if (stress <= 0.001 && pulseAmt <= 0.02) return;

    const cx = w / 2;
    const cy = h / 2;
    const maxDim = Math.max(w, h);

    const edgeAlpha = 0.08 + stress * 0.42 + pulseAmt * 0.38;
    const grad = ctx.createRadialGradient(
      cx,
      cy,
      maxDim * (0.28 - stress * 0.06),
      cx,
      cy,
      maxDim * (0.58 + stress * 0.08),
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.62, 'rgba(40,0,0,0)');
    grad.addColorStop(0.88, `rgba(120,8,12,${edgeAlpha * 0.55})`);
    grad.addColorStop(1, `rgba(160,10,18,${edgeAlpha})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    const veinStress = stress + pulseAmt * 0.85;
    for (const corner of CORNERS) {
      this.drawCornerVeins(ctx, corner, w, h, veinStress, this.timeSec, pulseAmt);
    }

    if (pulseAmt > 0.05) {
      ctx.fillStyle = `rgba(255,40,40,${pulseAmt * 0.12})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  private drawCornerVeins(
    ctx: CanvasRenderingContext2D,
    corner: Corner,
    w: number,
    h: number,
    stress: number,
    timeSec: number,
    pulse: number,
  ): void {
    const ox = corner.includes('r') ? w : 0;
    const oy = corner.includes('b') ? h : 0;
    const sx = corner.includes('r') ? -1 : 1;
    const sy = corner.includes('b') ? -1 : 1;
    const branchCount = 2 + Math.floor(stress * 3);
    const baseLen = 70 + stress * 150 + pulse * 55;

    ctx.save();
    ctx.translate(ox, oy);

    for (let b = 0; b < branchCount; b += 1) {
      const phase = b * 1.7 + (corner.charCodeAt(0) % 5);
      const wobble =
        Math.sin(timeSec * (2.4 + b * 0.35) + phase) * (8 + stress * 18) +
        Math.sin(timeSec * 5.1 + phase * 2) * (3 + pulse * 12);

      const angle = (Math.PI / 4 + b * 0.22) * sx * sy;
      const len = baseLen * (0.75 + b * 0.12);
      const alpha = 0.12 + stress * 0.5 + pulse * 0.35;
      const width = 1.2 + stress * 2.4 + pulse * 2.2;

      ctx.strokeStyle = `rgba(170, 18, 28, ${Math.min(0.92, alpha)})`;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);

      const cp1x = Math.cos(angle) * len * 0.35 + wobble * sx;
      const cp1y = Math.sin(angle) * len * 0.35 + wobble * sy;
      const cp2x = Math.cos(angle + 0.15 * sx) * len * 0.72 - wobble * 0.4 * sy;
      const cp2y = Math.sin(angle + 0.15 * sy) * len * 0.72 + wobble * 0.4 * sx;
      const ex = Math.cos(angle) * len + wobble * 0.6 * sx;
      const ey = Math.sin(angle) * len + wobble * 0.6 * sy;
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, ex, ey);
      ctx.stroke();

      if (stress > 0.35 || pulse > 0.2) {
        ctx.strokeStyle = `rgba(110, 8, 14, ${alpha * 0.65})`;
        ctx.lineWidth = width * 0.55;
        ctx.beginPath();
        ctx.moveTo(cp1x * 0.55, cp1y * 0.55);
        ctx.quadraticCurveTo(
          cp2x * 0.45 + wobble * 0.3,
          cp2y * 0.45 - wobble * 0.3,
          ex * 0.82 + 14 * sx,
          ey * 0.82 + 10 * sy,
        );
        ctx.stroke();
      }
    }

    ctx.restore();
  }
}
