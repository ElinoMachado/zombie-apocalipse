import Phaser from 'phaser';
import { getPrimaries, getSecondaries } from '../world/catalog/structures';

function hexCss(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

function darkenCss(color: number, amount = 18): string {
  return hexCss(
    Phaser.Display.Color.IntegerToColor(color).darken(amount).color,
  );
}

/** Legenda dos quadrados de construção — World Generator. */
export class StructureLegend {
  private readonly root: HTMLDivElement;

  constructor() {
    const host = document.getElementById('ui-root');
    if (!host) throw new Error('#ui-root não encontrado');

    this.root = document.createElement('div');
    this.root.id = 'structure-legend';
    this.root.style.cssText = [
      'position:absolute',
      'right:12px',
      'top:12px',
      'max-width:min(300px, calc(100vw - 32px))',
      'max-height:min(55vh, 420px)',
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
    title.textContent = 'Legenda · construções';
    title.style.cssText =
      'font-weight:600;font-size:12px;color:#8b949e;margin-bottom:8px;';
    this.root.append(title);

    this.root.append(this.makeSection('Principais', getPrimaries(), false));
    this.root.append(this.makeSection('Secundárias (tom mais escuro)', getSecondaries(), true));

    const note = document.createElement('div');
    note.style.cssText =
      'margin-top:8px;padding-top:8px;border-top:1px solid #21262d;color:#6e7681;font-size:11px;line-height:1.4;';
    note.textContent =
      'Cada retângulo no mapa usa a cor do tipo. Anexos partilham a paleta, ligeiramente mais escuros.';
    this.root.append(note);

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

  private makeSection(
    heading: string,
    defs: { label: string; color: number }[],
    darken: boolean,
  ): HTMLDivElement {
    const section = document.createElement('div');
    section.style.cssText = 'margin-bottom:10px;';

    const h = document.createElement('div');
    h.textContent = heading;
    h.style.cssText =
      'font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#6e7681;margin-bottom:6px;';
    section.append(h);

    const list = document.createElement('div');
    list.style.cssText = 'display:flex;flex-direction:column;gap:4px;';

    for (const def of defs) {
      const row = document.createElement('div');
      row.style.cssText =
        'display:flex;align-items:center;gap:8px;line-height:1.2;';
      const swatch = document.createElement('span');
      swatch.style.cssText = [
        'width:14px',
        'height:10px',
        'border-radius:2px',
        `background:${darken ? darkenCss(def.color) : hexCss(def.color)}`,
        'border:1px solid #00000066',
        'flex-shrink:0',
      ].join(';');
      const label = document.createElement('span');
      label.textContent = def.label;
      row.append(swatch, label);
      list.append(row);
    }

    section.append(list);
    return section;
  }
}
