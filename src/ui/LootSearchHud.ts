/**
 * Lupa + barra de progresso de vasculhar (5s).
 */
export class LootSearchHud {
  private root: HTMLButtonElement;
  private ring: HTMLDivElement;
  private onSearch: (() => void) | null = null;
  private visible = false;

  constructor() {
    const host = document.getElementById('ui-root');
    if (!host) throw new Error('#ui-root não encontrado');

    this.root = document.createElement('button');
    this.root.type = 'button';
    this.root.title = 'Vasculhar (5s)';
    this.root.setAttribute('aria-label', 'Vasculhar ponto de exploração');
    this.root.style.cssText = [
      'position:absolute',
      'left:0',
      'top:0',
      'width:44px',
      'height:44px',
      'margin:0',
      'padding:0',
      'display:none',
      'align-items:center',
      'justify-content:center',
      'border-radius:50%',
      'border:2px solid #ffe082',
      'background:rgba(13,17,23,0.92)',
      'box-shadow:0 0 0 3px rgba(255,224,130,0.2),0 8px 20px rgba(0,0,0,0.4)',
      'cursor:pointer',
      'z-index:15',
      'pointer-events:auto',
      'transform:translate(-50%,-110%)',
      'color:#ffe082',
      'overflow:hidden',
    ].join(';');

    this.ring = document.createElement('div');
    this.ring.style.cssText = [
      'position:absolute',
      'inset:0',
      'border-radius:50%',
      'background:conic-gradient(#58a6ff 0deg, transparent 0deg)',
      'opacity:0.55',
      'pointer-events:none',
    ].join(';');

    const icon = document.createElement('div');
    icon.style.cssText =
      'position:relative;z-index:1;display:flex;align-items:center;justify-content:center;';
    icon.innerHTML =
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" stroke-width="2.2"/>' +
      '<path d="M15.5 15.5L21 21" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>' +
      '</svg>';

    this.root.append(this.ring, icon);

    this.root.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      this.onSearch?.();
    });
    this.root.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
    });

    host.append(this.root);
  }

  setSearchHandler(fn: (() => void) | null): void {
    this.onSearch = fn;
  }

  /**
   * @param progress01 — 0..1 durante o canal; 0 se idle
   */
  sync(
    screenX: number | null,
    screenY: number | null,
    progress01 = 0,
  ): void {
    if (screenX == null || screenY == null) {
      if (this.visible) {
        this.root.style.display = 'none';
        this.visible = false;
      }
      return;
    }
    this.root.style.left = `${screenX}px`;
    this.root.style.top = `${screenY}px`;
    const deg = Math.max(0, Math.min(1, progress01)) * 360;
    this.ring.style.background = `conic-gradient(#58a6ff ${deg}deg, transparent ${deg}deg)`;
    this.root.style.borderColor = progress01 > 0 ? '#58a6ff' : '#ffe082';
    this.root.style.color = progress01 > 0 ? '#58a6ff' : '#ffe082';
    this.root.title =
      progress01 > 0 ? 'A vasculhar…' : 'Vasculhar (5 segundos)';
    if (!this.visible) {
      this.root.style.display = 'flex';
      this.visible = true;
    }
  }

  hide(): void {
    this.root.style.display = 'none';
    this.visible = false;
  }

  destroy(): void {
    this.onSearch = null;
    this.root.remove();
  }
}
