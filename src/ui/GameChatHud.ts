/**
 * Chat de comandos — Enter ou botão abre; Enter envia; Esc fecha.
 */
export class GameChatHud {
  private readonly overlay: HTMLDivElement;
  private readonly launcher: HTMLButtonElement;
  private readonly log: HTMLDivElement;
  private readonly input: HTMLInputElement;
  private panelOpen = false;
  private ignoreSubmitUntil = 0;
  private canOpen: (() => boolean) | null = null;
  private onSubmit: ((text: string) => void) | null = null;

  private readonly onGlobalKey = (ev: KeyboardEvent): void => {
    if (!this.canOpen?.() || this.panelOpen) return;
    if (ev.repeat || isTypingElement(ev.target)) return;

    const isEnter =
      ev.key === 'Enter' ||
      ev.key === 'NumpadEnter' ||
      ev.code === 'Enter' ||
      ev.code === 'NumpadEnter' ||
      ev.keyCode === 13;

    if (!isEnter) return;
    ev.preventDefault();
    this.openPanel();
  };

  constructor() {
    this.launcher = document.createElement('button');
    this.launcher.id = 'game-chat-launcher';
    this.launcher.type = 'button';
    this.launcher.textContent = 'Chat (Enter)';
    this.launcher.title = 'Abrir chat de comandos';
    this.launcher.style.cssText = [
      'position:fixed',
      'right:16px',
      'bottom:16px',
      'z-index:2147483646',
      'display:none',
      'padding:10px 14px',
      'border-radius:999px',
      'border:2px solid #58a6ff',
      'background:#0d1117',
      'color:#f0f6fc',
      'font:700 13px Segoe UI,system-ui,sans-serif',
      'cursor:pointer',
      'pointer-events:auto',
      'box-shadow:0 8px 24px rgba(0,0,0,0.45)',
    ].join(';');
    this.launcher.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      this.openPanel();
    });

    this.overlay = document.createElement('div');
    this.overlay.id = 'game-chat-overlay';
    this.overlay.style.cssText = HIDDEN_OVERLAY;

    const panel = document.createElement('div');
    panel.style.cssText = [
      'width:min(560px, calc(100vw - 32px))',
      'display:flex',
      'flex-direction:column',
      'gap:10px',
      'padding:14px',
      'border-radius:12px',
      'background:#0d1117',
      'border:2px solid #58a6ff',
      'box-shadow:0 20px 48px rgba(0,0,0,0.75)',
    ].join(';');

    const title = document.createElement('div');
    title.textContent = 'Chat de comandos';
    title.style.cssText =
      'font:700 13px Segoe UI,system-ui,sans-serif;color:#58a6ff;letter-spacing:0.05em;text-transform:uppercase;';

    this.log = document.createElement('div');
    this.log.style.cssText = [
      'max-height:150px',
      'overflow-y:auto',
      'padding:10px',
      'border-radius:8px',
      'background:#161b22',
      'border:1px solid #30363d',
      'font:12px/1.45 Segoe UI,system-ui,sans-serif',
      'color:#c9d1d9',
    ].join(';');

    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.autocomplete = 'off';
    this.input.spellcheck = false;
    this.input.placeholder = '/hit-boxes cars on';
    this.input.style.cssText = [
      'width:100%',
      'box-sizing:border-box',
      'padding:12px',
      'border-radius:8px',
      'border:2px solid #58a6ff',
      'background:#010409',
      'color:#f0f6fc',
      'font:16px Segoe UI,system-ui,sans-serif',
      'outline:none',
    ].join(';');

    this.input.addEventListener('keydown', (ev) => {
      ev.stopPropagation();
      if (ev.key === 'Enter') {
        ev.preventDefault();
        this.submitCurrent();
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        this.closePanel();
      }
    });

    panel.append(title, this.log, this.input);
    this.overlay.append(panel);
    document.body.append(this.launcher, this.overlay);
    window.addEventListener('keydown', this.onGlobalKey, true);
    this.appendLine('Enter ou botão Chat — abrir. Esc — fechar. /hit-boxes cars on|off', 'system');
  }

  setCanOpen(fn: (() => boolean) | null): void {
    this.canOpen = fn;
  }

  setSubmitHandler(fn: ((text: string) => void) | null): void {
    this.onSubmit = fn;
  }

  isOpen(): boolean {
    return this.panelOpen;
  }

  /** Abre o painel (Enter, botão ou fallback Phaser). */
  openPanel(): void {
    if (this.panelOpen) return;
    this.panelOpen = true;
    document.body.append(this.overlay);
    this.overlay.style.cssText = VISIBLE_OVERLAY;
    this.input.value = '';
    this.ignoreSubmitUntil = performance.now() + 250;
    window.setTimeout(() => {
      this.input.focus({ preventScroll: true });
    }, 0);
  }

  open(): void {
    this.openPanel();
  }

  showLauncher(): void {
    this.launcher.style.display = 'block';
  }

  hideLauncher(): void {
    this.launcher.style.display = 'none';
    this.closePanel();
  }

  close(): void {
    this.closePanel();
  }

  appendLine(text: string, kind: 'system' | 'user' | 'error' = 'system'): void {
    const line = document.createElement('div');
    const color =
      kind === 'user' ? '#79c0ff' : kind === 'error' ? '#ff8a8a' : '#8b949e';
    line.style.color = color;
    line.textContent = kind === 'user' ? `> ${text}` : text;
    this.log.append(line);
    this.log.scrollTop = this.log.scrollHeight;
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onGlobalKey, true);
    this.onSubmit = null;
    this.canOpen = null;
    this.launcher.remove();
    this.overlay.remove();
  }

  private closePanel(): void {
    if (!this.panelOpen) return;
    this.panelOpen = false;
    this.overlay.style.cssText = HIDDEN_OVERLAY;
    this.input.blur();
  }

  private submitCurrent(): void {
    if (performance.now() < this.ignoreSubmitUntil) return;
    const text = this.input.value.trim();
    if (!text) {
      this.closePanel();
      return;
    }
    this.appendLine(text, 'user');
    this.onSubmit?.(text);
    this.input.value = '';
    this.closePanel();
  }
}

const VISIBLE_OVERLAY = [
  'position:fixed',
  'inset:0',
  'z-index:2147483647',
  'display:flex',
  'align-items:flex-end',
  'justify-content:center',
  'padding:0 16px 32px',
  'box-sizing:border-box',
  'pointer-events:auto',
  'background:rgba(0,0,0,0.78)',
  'font-family:Segoe UI,system-ui,sans-serif',
].join(';');

const HIDDEN_OVERLAY = [
  'position:fixed',
  'inset:0',
  'z-index:2147483647',
  'display:none',
  'pointer-events:none',
].join(';');

function isTypingElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}
