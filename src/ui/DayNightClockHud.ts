/**
 * Relógio dia/noite — canto superior direito.
 * Sol (dia) ou lua (noite) completa uma volta por metade do ciclo.
 */
export class DayNightClockHud {
  private root: HTMLDivElement;
  private dial: HTMLDivElement;
  private progress: HTMLDivElement;
  private orbit: HTMLDivElement;
  private body: HTMLDivElement;
  private label: HTMLSpanElement;
  private sunEl: HTMLDivElement;
  private moonEl: HTMLDivElement;

  constructor() {
    const host = document.getElementById('ui-root');
    if (!host) throw new Error('#ui-root não encontrado');

    this.root = document.createElement('div');
    this.root.style.cssText = [
      'position:absolute',
      'top:12px',
      'right:12px',
      'display:none',
      'flex-direction:column',
      'align-items:center',
      'gap:6px',
      'z-index:5',
      'pointer-events:none',
      'font:11px Segoe UI,system-ui,sans-serif',
      'color:#e6edf3',
    ].join(';');

    this.dial = document.createElement('div');
    this.dial.style.cssText = [
      'position:relative',
      'width:64px',
      'height:64px',
      'border-radius:50%',
      'background:rgba(13,17,23,0.92)',
      'border:1px solid #30363d',
      'box-shadow:0 8px 24px rgba(0,0,0,0.35)',
      'overflow:hidden',
    ].join(';');

    this.progress = document.createElement('div');
    this.progress.style.cssText = [
      'position:absolute',
      'inset:0',
      'border-radius:50%',
      'background:conic-gradient(#ffe082 0deg, transparent 0deg)',
      'opacity:0.35',
    ].join(';');

    const hole = document.createElement('div');
    hole.style.cssText = [
      'position:absolute',
      'inset:7px',
      'border-radius:50%',
      'background:rgba(13,17,23,0.96)',
      'border:1px solid #21262d',
      'z-index:1',
    ].join(';');

    this.orbit = document.createElement('div');
    this.orbit.style.cssText = [
      'position:absolute',
      'inset:0',
      'z-index:2',
      'transform:rotate(0deg)',
      'will-change:transform',
    ].join(';');

    this.body = document.createElement('div');
    this.body.style.cssText = [
      'position:absolute',
      'left:50%',
      'top:5px',
      'width:14px',
      'height:14px',
      'margin-left:-7px',
      'display:flex',
      'align-items:center',
      'justify-content:center',
    ].join(';');

    this.sunEl = document.createElement('div');
    this.sunEl.style.cssText = [
      'width:12px',
      'height:12px',
      'border-radius:50%',
      'background:radial-gradient(circle at 35% 35%,#fff59d,#ffb300 55%,#f57c00)',
      'box-shadow:0 0 8px rgba(255,179,0,0.85)',
    ].join(';');

    this.moonEl = document.createElement('div');
    this.moonEl.style.cssText = [
      'width:12px',
      'height:12px',
      'border-radius:50%',
      'background:#cfd8dc',
      'box-shadow:inset -3px -1px 0 1px #546e7a,0 0 6px rgba(207,216,220,0.55)',
      'display:none',
    ].join(';');

    this.body.append(this.sunEl, this.moonEl);
    this.orbit.append(this.body);
    this.dial.append(this.progress, hole, this.orbit);

    this.label = document.createElement('span');
    this.label.style.cssText = [
      'padding:2px 8px',
      'border-radius:999px',
      'background:rgba(13,17,23,0.9)',
      'border:1px solid #30363d',
      'font-weight:600',
      'letter-spacing:0.04em',
      'text-transform:uppercase',
      'font-size:10px',
      'color:#8b949e',
    ].join(';');
    this.label.textContent = 'Dia';

    this.root.append(this.dial, this.label);
    host.append(this.root);
  }

  show(): void {
    this.root.style.display = 'flex';
  }

  hide(): void {
    this.root.style.display = 'none';
  }

  /**
   * @param isDay — sol de dia, lua de noite
   * @param halfPhase01 — 0..1 progresso da metade actual (uma volta)
   */
  sync(isDay: boolean, halfPhase01: number): void {
    const t = Math.max(0, Math.min(1, halfPhase01));
    const deg = t * 360;

    this.orbit.style.transform = `rotate(${deg}deg)`;
    // Mantém o ícone “em pé” enquanto orbita
    this.body.style.transform = `rotate(${-deg}deg)`;

    const accent = isDay ? '#ffe082' : '#90caf9';
    this.progress.style.background = `conic-gradient(${accent} ${deg}deg, transparent ${deg}deg)`;

    this.sunEl.style.display = isDay ? 'block' : 'none';
    this.moonEl.style.display = isDay ? 'none' : 'block';
    this.dial.style.borderColor = isDay ? '#3d3418' : '#1e2a3a';
    this.label.textContent = isDay ? 'Dia' : 'Noite';
    this.label.style.color = accent;
  }

  destroy(): void {
    this.root.remove();
  }
}
