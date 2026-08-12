import { getExplorations } from '../world/catalog/structures';

function hexCss(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

/** Legenda dos pontos coloridos (POIs de exploração) — modo teste. */
export class MapLegend {
  private root: HTMLDivElement;

  constructor() {
    const host = document.getElementById('ui-root');
    if (!host) throw new Error('#ui-root não encontrado');

    this.root = document.createElement('div');
    this.root.style.cssText = [
      'position:absolute',
      'right:12px',
      'bottom:12px',
      'max-width:min(280px, calc(100vw - 24px))',
      'max-height:min(50vh, 360px)',
      'overflow:auto',
      'background:rgba(13,17,23,0.92)',
      'border:1px solid #30363d',
      'border-radius:8px',
      'padding:10px 12px',
      'color:#e6edf3',
      'font:12px Segoe UI,system-ui,sans-serif',
      'box-shadow:0 8px 24px rgba(0,0,0,0.35)',
      'pointer-events:auto',
      'z-index:5',
      'display:none',
    ].join(';');

    const title = document.createElement('div');
    title.textContent = 'Legenda · pontos no mapa';
    title.style.cssText =
      'font-weight:600;font-size:12px;color:#8b949e;margin-bottom:8px;';
    this.root.append(title);

    const list = document.createElement('div');
    list.style.cssText = 'display:flex;flex-direction:column;gap:5px;';

    for (const def of getExplorations()) {
      const row = document.createElement('div');
      row.style.cssText =
        'display:flex;align-items:center;gap:8px;line-height:1.2;';
      const swatch = document.createElement('span');
      swatch.style.cssText = [
        'width:10px',
        'height:10px',
        'border-radius:50%',
        `background:${hexCss(def.color)}`,
        'border:1px solid #00000066',
        'flex-shrink:0',
      ].join(';');
      const label = document.createElement('span');
      label.textContent = def.label;
      label.style.color = '#e6edf3';
      row.append(swatch, label);
      list.append(row);
    }

    const note = document.createElement('div');
    note.style.cssText =
      'margin-top:8px;padding-top:8px;border-top:1px solid #30363d;color:#8b949e;font-size:11px;';
    note.innerHTML = [
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><span style="width:14px;height:8px;background:#3a3f46;border-radius:2px;display:inline-block"></span>Carro destruído (sprites)</div>',
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><span style="width:10px;height:10px;background:#5c4033;border-radius:2px;display:inline-block"></span>Escombros</div>',
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><span style="width:10px;height:10px;background:#ff6d00;border-radius:50%;display:inline-block"></span>Escombros a arder</div>',
      '<div style="display:flex;align-items:center;gap:8px"><span style="width:4px;height:14px;background:#ffe082;display:inline-block"></span>Poste de luz</div>',
    ].join('');

    this.root.append(list, note);
    host.append(this.root);
  }

  show(): void {
    this.root.style.display = 'block';
  }

  hide(): void {
    this.root.style.display = 'none';
  }

  destroy(): void {
    this.root.remove();
  }
}
