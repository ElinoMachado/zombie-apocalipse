import { GAME_VERSION } from '../version';

/** Badge fixo com a versão do jogo — canto superior direito. */
export class VersionBadge {
  private readonly root: HTMLDivElement;

  constructor() {
    this.root = document.createElement('div');
    this.root.id = 'game-version-badge';
    this.root.textContent = `v${GAME_VERSION}`;
    this.root.style.cssText = [
      'position:fixed',
      'top:10px',
      'right:12px',
      'z-index:210',
      'pointer-events:none',
      'font:600 11px/1 Segoe UI,system-ui,sans-serif',
      'letter-spacing:0.02em',
      'color:#8b949e',
      'text-shadow:0 1px 2px rgba(1,4,9,0.85)',
      'user-select:none',
    ].join(';');

    document.body.appendChild(this.root);
  }
}
