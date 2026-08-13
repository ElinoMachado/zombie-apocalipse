import type { CitySizeClass } from '../world/model/types';
import { DEFAULT_PLAY_CITY_SIZE } from '../world/model/types';
import { getDefaultProfileId, listProfiles } from '../world/profiles';

export interface GenerateCityButtonHandlers {
  onGenerate: (sizeClass: CitySizeClass, profileId: string) => void;
  onBack?: () => void;
  onEnemySpawnToggle?: (show: boolean) => void;
}

const SIZE_OPTIONS: { value: CitySizeClass; label: string }[] = [
  { value: 'small', label: 'Pequena' },
  { value: 'medium', label: 'Média' },
  { value: 'large', label: 'Grande' },
];

const selectCss = [
  'appearance:none',
  'width:100%',
  'padding:8px 10px',
  'border-radius:6px',
  'border:1px solid #30363d',
  'background:#161b22',
  'color:#e6edf3',
  'font:14px Segoe UI,system-ui,sans-serif',
  'cursor:pointer',
].join(';');

export class GenerateCityButton {
  private root: HTMLDivElement;
  private sizeSelect: HTMLSelectElement;
  private profileSelect: HTMLSelectElement;
  private seedEl: HTMLSpanElement;
  private nameEl: HTMLSpanElement;
  private statsEl: HTMLSpanElement;
  private dumpEl: HTMLPreElement;
  private hintEl: HTMLDivElement;
  private enemySpawnToggle: HTMLInputElement;

  constructor(handlers: GenerateCityButtonHandlers) {
    const host = document.getElementById('ui-root');
    if (!host) throw new Error('#ui-root não encontrado');

    this.root = document.createElement('div');
    this.root.style.cssText = [
      'position:absolute',
      'top:16px',
      'left:16px',
      'display:flex',
      'flex-direction:column',
      'gap:8px',
      'max-width:min(420px, calc(100vw - 32px))',
    ].join(';');

    const panel = document.createElement('div');
    panel.style.cssText = [
      'background:rgba(13,17,23,0.9)',
      'border:1px solid #30363d',
      'border-radius:8px',
      'padding:12px 14px',
      'color:#e6edf3',
      'box-shadow:0 8px 24px rgba(0,0,0,0.35)',
    ].join(';');

    const title = document.createElement('div');
    title.textContent = 'World Generator';
    title.style.cssText =
      'font-size:13px;font-weight:600;margin-bottom:8px;color:#8b949e;';

    const sizeRow = document.createElement('label');
    sizeRow.style.cssText =
      'display:flex;flex-direction:column;gap:4px;margin-bottom:10px;font-size:12px;color:#8b949e;';
    sizeRow.append('Tamanho da cidade');

    this.sizeSelect = document.createElement('select');
    this.sizeSelect.style.cssText = selectCss;
    for (const opt of SIZE_OPTIONS) {
      const el = document.createElement('option');
      el.value = opt.value;
      el.textContent = opt.label;
      if (opt.value === DEFAULT_PLAY_CITY_SIZE) el.selected = true;
      this.sizeSelect.append(el);
    }
    sizeRow.append(this.sizeSelect);

    const profileRow = document.createElement('label');
    profileRow.style.cssText =
      'display:flex;flex-direction:column;gap:4px;margin-bottom:10px;font-size:12px;color:#8b949e;';
    profileRow.append('City profile');

    this.profileSelect = document.createElement('select');
    this.profileSelect.style.cssText = selectCss;
    const defaultId = getDefaultProfileId();
    const preferred = 'BrazilianMediumCity';
    const profiles = listProfiles();
    const hasPreferred = profiles.some((p) => p.id === preferred);
    for (const p of profiles) {
      const el = document.createElement('option');
      el.value = p.id;
      el.textContent = p.label;
      if (p.id === (hasPreferred ? preferred : defaultId)) el.selected = true;
      this.profileSelect.append(el);
    }
    profileRow.append(this.profileSelect);

    const enemyRow = document.createElement('label');
    enemyRow.style.cssText =
      'display:flex;align-items:center;gap:8px;margin-bottom:10px;font-size:12px;color:#c9d1d9;cursor:pointer;';
    this.enemySpawnToggle = document.createElement('input');
    this.enemySpawnToggle.type = 'checkbox';
    this.enemySpawnToggle.checked = true;
    this.enemySpawnToggle.style.cursor = 'pointer';
    this.enemySpawnToggle.addEventListener('change', () => {
      handlers.onEnemySpawnToggle?.(this.enemySpawnToggle.checked);
    });
    enemyRow.append(
      this.enemySpawnToggle,
      document.createTextNode('Mostrar spawns inimigos'),
    );

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Gerar mapa';
    btn.style.cssText = [
      'appearance:none',
      'border:1px solid #3d8bfd',
      'background:#1f6feb',
      'color:#fff',
      'font:600 14px Segoe UI,system-ui,sans-serif',
      'padding:10px 14px',
      'border-radius:6px',
      'cursor:pointer',
      'width:100%',
    ].join(';');
    btn.addEventListener('mouseenter', () => {
      btn.style.background = '#388bfd';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = '#1f6feb';
    });
    btn.addEventListener('click', () => {
      handlers.onGenerate(this.getSizeClass(), this.getProfileId());
    });

    if (handlers.onBack) {
      const backBtn = document.createElement('button');
      backBtn.type = 'button';
      backBtn.textContent = '← Voltar ao menu';
      backBtn.style.cssText = [
        'appearance:none',
        'border:1px solid #30363d',
        'background:#161b22',
        'color:#8b949e',
        'font:600 13px Segoe UI,system-ui,sans-serif',
        'padding:8px 12px',
        'border-radius:6px',
        'cursor:pointer',
        'width:100%',
        'margin-bottom:10px',
      ].join(';');
      backBtn.addEventListener('click', () => handlers.onBack?.());
      panel.prepend(backBtn);
    }

    this.nameEl = document.createElement('span');
    this.nameEl.style.cssText =
      'display:block;margin-top:10px;font-size:14px;font-weight:600;';

    this.seedEl = document.createElement('span');
    this.seedEl.style.cssText =
      'display:block;margin-top:4px;font-size:12px;color:#8b949e;font-family:ui-monospace,Consolas,monospace;';

    this.statsEl = document.createElement('span');
    this.statsEl.style.cssText =
      'display:block;margin-top:4px;font-size:12px;color:#8b949e;';

    this.dumpEl = document.createElement('pre');
    this.dumpEl.style.cssText = [
      'margin-top:10px',
      'max-height:220px',
      'overflow:auto',
      'font:11px/1.4 ui-monospace,Consolas,monospace',
      'color:#9aa7b5',
      'background:#0d1117',
      'border:1px solid #21262d',
      'border-radius:6px',
      'padding:8px',
      'white-space:pre-wrap',
    ].join(';');

    const hint = document.createElement('div');
    hint.textContent =
      'Gera o mapa · WASD move · roda do rato ou [ ] zoom · ESC volta ao menu';
    hint.style.cssText = 'margin-top:8px;font-size:11px;color:#6e7681;';
    this.hintEl = hint;

    panel.append(
      title,
      sizeRow,
      profileRow,
      enemyRow,
      btn,
      this.nameEl,
      this.seedEl,
      this.statsEl,
      this.dumpEl,
      hint,
    );
    this.root.append(panel);
    host.append(this.root);
  }

  getSizeClass(): CitySizeClass {
    const v = this.sizeSelect.value;
    if (v === 'small' || v === 'medium' || v === 'large') return v;
    return DEFAULT_PLAY_CITY_SIZE;
  }

  getProfileId(): string {
    return this.profileSelect.value || getDefaultProfileId();
  }

  getShowEnemySpawns(): boolean {
    return this.enemySpawnToggle.checked;
  }

  updateInfo(info: {
    name: string;
    seed: number;
    sizeClass: string;
    profileId?: string;
    primaries: number;
    secondaries: number;
    pois: number;
    dump: string;
  }): void {
    const profileBit = info.profileId ? ` · ${info.profileId}` : '';
    this.nameEl.textContent = `${info.name} (${info.sizeClass}${profileBit})`;
    this.seedEl.textContent = `seed: ${info.seed}`;
    this.statsEl.textContent = `${info.primaries} estruturas · ${info.secondaries} anexos · ${info.pois} POIs`;
    this.dumpEl.textContent = info.dump;
  }

  clearInfo(): void {
    this.nameEl.textContent = '';
    this.seedEl.textContent = '';
    this.statsEl.textContent = '';
    this.dumpEl.textContent = '';
  }

  setHint(text: string): void {
    this.hintEl.textContent = text;
  }

  hide(): void {
    this.root.style.display = 'none';
  }

  show(): void {
    this.root.style.display = 'flex';
  }

  destroy(): void {
    this.root.remove();
  }
}
