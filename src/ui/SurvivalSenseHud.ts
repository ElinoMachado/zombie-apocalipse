import {
  SURVIVAL_SENSE_COOLDOWN_MS,
} from '../game/resources/ResourceManager';

/** Indicador do sentido de sobrevivência (Space) — canto inferior direito da barra. */
export class SurvivalSenseHud {
  private root: HTMLDivElement;
  private fill: HTMLDivElement;
  private label: HTMLSpanElement;

  constructor() {
    const host = document.getElementById('ui-root');
    if (!host) throw new Error('#ui-root não encontrado');

    this.root = document.createElement('div');
    this.root.style.cssText = [
      'position:absolute',
      'right:12px',
      'bottom:92px',
      'display:none',
      'flex-direction:column',
      'align-items:flex-end',
      'gap:4px',
      'z-index:6',
      'pointer-events:none',
      'font:11px Segoe UI,system-ui,sans-serif',
      'color:#8b949e',
    ].join(';');

    this.label = document.createElement('span');
    this.label.textContent = 'Espaço · Sentido';
    this.label.style.cssText = 'font-weight:600;letter-spacing:0.03em;';

    const track = document.createElement('div');
    track.style.cssText = [
      'width:110px',
      'height:8px',
      'border-radius:999px',
      'background:#21262d',
      'border:1px solid #30363d',
      'overflow:hidden',
    ].join(';');

    this.fill = document.createElement('div');
    this.fill.style.cssText = [
      'height:100%',
      'width:100%',
      'background:linear-gradient(90deg,#1f6feb,#58a6ff)',
      'border-radius:999px',
      'transition:width 120ms linear',
    ].join(';');
    track.append(this.fill);

    this.root.append(this.label, track);
    host.append(this.root);
  }

  show(): void {
    this.root.style.display = 'flex';
  }

  hide(): void {
    this.root.style.display = 'none';
  }

  /** cooldown01: 0 = pronto, 1 = em CD total. */
  sync(cooldown01: number): void {
    const ready = cooldown01 <= 0.001;
    const charged = 1 - Math.max(0, Math.min(1, cooldown01));
    this.fill.style.width = `${(charged * 100).toFixed(1)}%`;
    if (ready) {
      this.label.textContent = 'Espaço · Sentido pronto';
      this.label.style.color = '#58a6ff';
      this.fill.style.opacity = '1';
    } else {
      const sec = Math.ceil(cooldown01 * (SURVIVAL_SENSE_COOLDOWN_MS / 1000));
      this.label.textContent = `Espaço · ${sec}s`;
      this.label.style.color = '#8b949e';
      this.fill.style.opacity = '0.75';
    }
  }

  destroy(): void {
    this.root.remove();
  }
}
