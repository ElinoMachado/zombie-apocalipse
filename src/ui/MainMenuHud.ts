export interface MainMenuHandlers {
  onPlay: () => void;
  /** Modo dev: um exemplar de cada POI junto ao spawn. */
  onPlayDev?: () => void;
  onWorldGenerator?: () => void;
  onSprites?: () => void;
}

const btnCss = [
  'appearance:none',
  'width:100%',
  'padding:14px 18px',
  'border-radius:8px',
  'font:600 15px Segoe UI,system-ui,sans-serif',
  'cursor:pointer',
  'border:1px solid #30363d',
  'transition:background 0.15s,border-color 0.15s',
].join(';');

/** Menu principal do jogo. */
export class MainMenuHud {
  private readonly root: HTMLDivElement;
  private readonly devSection: HTMLDivElement;

  constructor(handlers: MainMenuHandlers, devMode: boolean) {
    const host = document.getElementById('ui-root');
    if (!host) throw new Error('#ui-root não encontrado');

    this.root = document.createElement('div');
    this.root.id = 'main-menu';
    this.root.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:200',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'background:radial-gradient(ellipse at center, rgba(22,27,34,0.96) 0%, rgba(1,4,9,0.98) 70%)',
      'pointer-events:auto',
      'font-family:Segoe UI,system-ui,sans-serif',
      'color:#e6edf3',
    ].join(';');

    const panel = document.createElement('div');
    panel.style.cssText = [
      'width:min(420px, calc(100vw - 32px))',
      'padding:28px 26px',
      'border-radius:14px',
      'background:rgba(13,17,23,0.95)',
      'border:1px solid #30363d',
      'box-shadow:0 24px 64px rgba(0,0,0,0.55)',
      'display:flex',
      'flex-direction:column',
      'gap:12px',
    ].join(';');

    const title = document.createElement('h1');
    title.textContent = 'Como Sobreviver ao Apocalipse';
    title.style.cssText =
      'margin:0 0 4px;font-size:22px;font-weight:700;line-height:1.2;color:#f0f6fc;';

    const subtitle = document.createElement('p');
    subtitle.textContent = 'Sobrevive, explora e luta pelo que restou do mundo.';
    subtitle.style.cssText = 'margin:0 0 8px;font-size:13px;color:#8b949e;line-height:1.45;';

    const playBtn = this.makeButton('Jogar', 'primary');
    playBtn.addEventListener('click', () => handlers.onPlay());
    panel.append(title, subtitle, playBtn);

    this.devSection = document.createElement('div');
    this.devSection.style.cssText =
      'display:flex;flex-direction:column;gap:8px;margin-top:8px;padding-top:14px;border-top:1px solid #21262d;';

    if (devMode) {
      const devLabel = document.createElement('div');
      devLabel.textContent = 'Desenvolvimento';
      devLabel.style.cssText =
        'font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#6e7681;';

      const genBtn = this.makeButton('World Generator', 'secondary');
      genBtn.addEventListener('click', () => handlers.onWorldGenerator?.());

      const playDevBtn = this.makeButton('Jogar — dev', 'secondary');
      playDevBtn.addEventListener('click', () => handlers.onPlayDev?.());

      const spritesBtn = this.makeButton('Sprites — ajustar hitboxes', 'secondary');
      spritesBtn.addEventListener('click', () => handlers.onSprites?.());

      this.devSection.append(devLabel, genBtn, playDevBtn, spritesBtn);
      panel.append(this.devSection);
    }

    this.root.append(panel);
    host.append(this.root);
  }

  show(): void {
    this.root.style.display = 'flex';
  }

  hide(): void {
    this.root.style.display = 'none';
  }

  destroy(): void {
    this.root.remove();
  }

  private makeButton(label: string, kind: 'primary' | 'secondary'): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.style.cssText = btnCss;
    if (kind === 'primary') {
      btn.style.background = '#1f6feb';
      btn.style.borderColor = '#3d8bfd';
      btn.style.color = '#fff';
      btn.addEventListener('mouseenter', () => {
        btn.style.background = '#388bfd';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = '#1f6feb';
      });
    } else {
      btn.style.background = '#161b22';
      btn.style.color = '#c9d1d9';
      btn.addEventListener('mouseenter', () => {
        btn.style.borderColor = '#58a6ff';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.borderColor = '#30363d';
      });
    }
    return btn;
  }
}
