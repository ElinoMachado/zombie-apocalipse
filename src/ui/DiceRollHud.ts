import type { NoiseRollResult } from '../game/combat/noiseAlert';
import { NOISE_DIE_SIDES } from '../game/combat/noiseAlert';

/**
 * Overlay rápido de 4d4 — rolagem visível ao disparar a pistola.
 */
export class DiceRollHud {
  private root: HTMLDivElement;
  private diceEls: HTMLDivElement[] = [];
  private caption: HTMLDivElement;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private animTimers: ReturnType<typeof setTimeout>[] = [];

  constructor() {
    const host = document.getElementById('ui-root');
    if (!host) throw new Error('#ui-root não encontrado');

    this.root = document.createElement('div');
    this.root.style.cssText = [
      'position:absolute',
      'left:50%',
      'top:18%',
      'transform:translateX(-50%)',
      'display:none',
      'flex-direction:column',
      'align-items:center',
      'gap:8px',
      'padding:12px 16px',
      'background:rgba(13,17,23,0.92)',
      'border:1px solid #30363d',
      'border-radius:10px',
      'box-shadow:0 12px 32px rgba(0,0,0,0.45)',
      'z-index:20',
      'pointer-events:none',
      'font:13px Segoe UI,system-ui,sans-serif',
      'color:#e6edf3',
    ].join(';');

    const title = document.createElement('div');
    title.textContent = 'Barulho · 4d4';
    title.style.cssText =
      'font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#8b949e;font-weight:600;';

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;';

    for (let i = 0; i < 4; i += 1) {
      const die = document.createElement('div');
      die.style.cssText = [
        'width:42px',
        'height:42px',
        'border-radius:8px',
        'background:#21262d',
        'border:2px solid #484f58',
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'font-size:22px',
        'font-weight:800',
        'font-variant-numeric:tabular-nums',
        'transition:transform 80ms ease,border-color 80ms,background 80ms,color 80ms',
      ].join(';');
      die.textContent = '·';
      this.diceEls.push(die);
      row.append(die);
    }

    this.caption = document.createElement('div');
    this.caption.style.cssText =
      'min-height:18px;font-size:12px;font-weight:600;color:#ffe082;text-align:center;';

    this.root.append(title, row, this.caption);
    host.append(this.root);
  }

  /** Anima a rolagem e mostra o resultado final. */
  play(result: NoiseRollResult): void {
    this.clearTimers();
    this.root.style.display = 'flex';
    this.caption.textContent = '';
    this.caption.style.color = '#ffe082';

    for (const el of this.diceEls) {
      el.style.borderColor = '#484f58';
      el.style.background = '#21262d';
      el.style.color = '#e6edf3';
      el.style.transform = 'scale(1)';
    }

    const flickerMs = 420;
    const step = 45;
    let t = 0;
    while (t < flickerMs) {
      const at = t;
      this.animTimers.push(
        setTimeout(() => {
          for (const el of this.diceEls) {
            el.textContent = String(1 + Math.floor(Math.random() * NOISE_DIE_SIDES));
            el.style.transform = `scale(${0.92 + Math.random() * 0.16})`;
          }
        }, at),
      );
      t += step;
    }

    this.animTimers.push(
      setTimeout(() => {
        for (let i = 0; i < this.diceEls.length; i += 1) {
          const el = this.diceEls[i]!;
          const value = result.dice[i] ?? 1;
          el.textContent = String(value);
          el.style.transform = 'scale(1.08)';
          if (value === NOISE_DIE_SIDES) {
            el.style.borderColor = '#f85149';
            el.style.background = '#3d1111';
            el.style.color = '#ff8a80';
          } else {
            el.style.borderColor = '#484f58';
            el.style.background = '#21262d';
            el.style.color = '#e6edf3';
          }
        }

        if (result.elite) {
          this.caption.textContent = 'ELITE atraído!';
          this.caption.style.color = '#ffd700';
        } else if (result.noiseHeard) {
          this.caption.textContent = 'Um zumbi ouviu o tiro…';
          this.caption.style.color = '#ff8a80';
        } else {
          this.caption.textContent = 'Ninguém ouviu…';
          this.caption.style.color = '#8b949e';
        }
      }, flickerMs),
    );

    this.hideTimer = setTimeout(() => {
      this.root.style.display = 'none';
    }, flickerMs + 1400);
  }

  hide(): void {
    this.clearTimers();
    this.root.style.display = 'none';
  }

  private clearTimers(): void {
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.hideTimer = null;
    for (const t of this.animTimers) clearTimeout(t);
    this.animTimers = [];
  }

  destroy(): void {
    this.clearTimers();
    this.root.remove();
  }
}
