import {
  collectPlayerStatusBadges,
  type StatusBadge,
} from '../game/survival/survivalStatusBadges';
import type { SurvivalState } from '../game/survival/SurvivalState';

/** Condições do jogador — canto superior central (sangramento, infecção, buffs…). */
export class PlayerStatusHud {
  private root: HTMLDivElement;
  private row: HTMLDivElement;

  constructor() {
    const host = document.getElementById('ui-root');
    if (!host) throw new Error('#ui-root não encontrado');

    this.root = document.createElement('div');
    this.root.style.cssText = [
      'position:absolute',
      'top:10px',
      'left:50%',
      'transform:translateX(-50%)',
      'display:none',
      'flex-direction:column',
      'align-items:center',
      'gap:4px',
      'z-index:7',
      'pointer-events:none',
      'max-width:min(92vw,560px)',
    ].join(';');

    this.row = document.createElement('div');
    this.row.style.cssText = [
      'display:flex',
      'flex-wrap:wrap',
      'justify-content:center',
      'gap:6px',
      'font:600 11px Segoe UI,system-ui,sans-serif',
    ].join(';');

    this.root.append(this.row);
    host.append(this.root);
  }

  show(): void {
    this.root.style.display = 'flex';
  }

  hide(): void {
    this.root.style.display = 'none';
  }

  sync(survival: SurvivalState | null, burning = false): void {
    if (!survival) {
      this.row.replaceChildren();
      return;
    }

    const badges = collectPlayerStatusBadges(survival, { burning });
    this.row.replaceChildren(...badges.map((b) => this.badgeEl(b)));
  }

  private badgeEl(badge: StatusBadge): HTMLSpanElement {
    const el = document.createElement('span');
    el.dataset.statusId = badge.id;
    el.textContent = badge.label;
    el.style.cssText = [
      'padding:3px 9px',
      'border-radius:999px',
      'border:1px solid color-mix(in srgb, var(--c) 55%, #30363d)',
      'background:color-mix(in srgb, var(--c) 18%, #0d1117)',
      'color:var(--c)',
      'letter-spacing:0.02em',
      'white-space:nowrap',
      'box-shadow:0 2px 8px rgba(0,0,0,0.35)',
    ].join(';');
    el.style.setProperty('--c', badge.color);
    return el;
  }

  destroy(): void {
    this.root.remove();
  }
}
