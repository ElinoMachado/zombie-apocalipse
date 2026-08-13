import { POI_SPRITE_ROTATION_OVERRIDES } from '../assets/poiSpriteRotation';
import {
  POI_SPRITE_TUNING_CATALOG,
  POI_TUNING_PREVIEW_SEED,
  type PoiSpriteTuningEntry,
} from '../assets/poiSpriteTuningCatalog';
import {
  clearAllRuntimePoiRotationOverrides,
  clearRuntimePoiRotationOverride,
  exportPoiRotationOverridesCode,
  exportPoiRotationOverridesJson,
  getRuntimePoiRotationOverrides,
  saveMergedPoiRotationOverride,
} from '../game/dev/poiRotationOverrides';

const degToRad = (d: number): number => (d * Math.PI) / 180;
const radToDeg = (r: number): number => (r * 180) / Math.PI;

export interface PoiRotationTuningHandlers {
  onClose: () => void;
}

/** Ferramenta dev — rotação extra dos sprites de POI (por tipo + frame). */
export class PoiRotationTuningHud {
  private readonly root: HTMLDivElement;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private typeSelect!: HTMLSelectElement;
  private frameLabel!: HTMLSpanElement;
  private exportBox!: HTMLTextAreaElement;
  private readonly sheetCache = new Map<string, HTMLImageElement>();
  private readonly sheetReady = new Set<string>();
  private typeIndex = 0;
  private frameIndex = 0;
  private artRotationRad = 0;
  private previewWorldRotDeg = 0;
  private readonly controlEls = new Map<string, HTMLInputElement>();

  constructor(handlers: PoiRotationTuningHandlers) {
    this.root = document.createElement('div');
    this.root.id = 'poi-rotation-tuning';
    this.root.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:210',
      'display:flex',
      'flex-direction:column',
      'background:#0d1117',
      'color:#e6edf3',
      'pointer-events:auto',
      'font:13px Segoe UI,system-ui,sans-serif',
    ].join(';');

    const header = document.createElement('div');
    header.style.cssText =
      'display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #30363d;';
    const hTitle = document.createElement('strong');
    hTitle.textContent = 'Sprites — rotação dos POIs';
    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.textContent = '← Menu';
    backBtn.style.cssText =
      'padding:8px 12px;border-radius:6px;border:1px solid #30363d;background:#161b22;color:#c9d1d9;cursor:pointer;';
    backBtn.addEventListener('click', () => handlers.onClose());
    header.append(hTitle, backBtn);

    const body = document.createElement('div');
    body.style.cssText =
      'flex:1;display:grid;grid-template-columns:220px 1fr 300px;gap:12px;padding:12px;min-height:0;overflow:hidden;';

    body.append(
      this.buildTypeColumn(),
      this.buildPreviewColumn(),
      this.buildControlColumn(),
    );
    this.root.append(header, body);
    document.body.append(this.root);

    this.preloadSheets();
    this.reloadFromSelection();
    this.syncControls();
    this.redrawPreview();
  }

  destroy(): void {
    this.root.remove();
  }

  private getEntry(): PoiSpriteTuningEntry {
    return POI_SPRITE_TUNING_CATALOG[this.typeIndex]!;
  }

  private getFrame(): number {
    const entry = this.getEntry();
    return Math.min(entry.frameCount - 1, Math.max(0, this.frameIndex));
  }

  private codeOverride(typeId: string, frame: number): number {
    return POI_SPRITE_ROTATION_OVERRIDES[typeId]?.[frame]?.artRotation ?? 0;
  }

  private buildTypeColumn(): HTMLDivElement {
    const col = document.createElement('div');
    col.style.cssText =
      'display:flex;flex-direction:column;gap:8px;overflow:auto;border:1px solid #30363d;border-radius:8px;padding:8px;background:#161b22;';

    const label = document.createElement('div');
    label.textContent = 'Tipo de POI';
    label.style.cssText = 'font-size:11px;color:#8b949e;font-weight:700;text-transform:uppercase;';

    this.typeSelect = document.createElement('select');
    this.typeSelect.style.cssText =
      'width:100%;padding:8px;border-radius:6px;border:1px solid #30363d;background:#0d1117;color:#e6edf3;';
    for (const entry of POI_SPRITE_TUNING_CATALOG) {
      const opt = document.createElement('option');
      opt.value = entry.typeId;
      opt.textContent = entry.label;
      this.typeSelect.append(opt);
    }
    this.typeSelect.addEventListener('change', () => {
      this.typeIndex = this.typeSelect.selectedIndex;
      this.frameIndex = 0;
      this.reloadFromSelection();
      this.syncControls();
      this.redrawPreview();
    });

    const frameTitle = document.createElement('div');
    frameTitle.textContent = 'Frame';
    frameTitle.style.cssText =
      'font-size:11px;color:#8b949e;font-weight:700;text-transform:uppercase;margin-top:8px;';

    const nav = document.createElement('div');
    nav.style.cssText = 'display:flex;gap:6px;';
    const prev = this.makeSmallBtn('◀');
    prev.addEventListener('click', () => this.stepFrame(-1));
    const next = this.makeSmallBtn('▶');
    next.addEventListener('click', () => this.stepFrame(1));
    this.frameLabel = document.createElement('span');
    this.frameLabel.style.cssText =
      'flex:1;display:flex;align-items:center;justify-content:center;font:600 12px ui-monospace,Consolas,monospace;color:#79c0ff;';
    nav.append(prev, this.frameLabel, next);

    col.append(label, this.typeSelect, frameTitle, nav);
    return col;
  }

  private buildPreviewColumn(): HTMLDivElement {
    const col = document.createElement('div');
    col.style.cssText =
      'display:flex;flex-direction:column;min-height:0;border:1px solid #30363d;border-radius:8px;background:#161b22;overflow:hidden;';

    const cap = document.createElement('div');
    cap.textContent = 'Pré-visualização';
    cap.style.cssText = 'padding:8px 10px;font-size:11px;color:#8b949e;border-bottom:1px solid #30363d;';

    this.canvas = document.createElement('canvas');
    this.canvas.width = 640;
    this.canvas.height = 480;
    this.canvas.style.cssText = 'width:100%;height:100%;flex:1;display:block;';
    this.ctx = this.canvas.getContext('2d')!;

    col.append(cap, this.canvas);
    return col;
  }

  private buildControlColumn(): HTMLDivElement {
    const col = document.createElement('div');
    col.style.cssText =
      'display:flex;flex-direction:column;gap:10px;overflow:auto;border:1px solid #30363d;border-radius:8px;padding:10px;background:#161b22;';

    col.append(
      this.makeSlider(
        'Rotação extra sprite (°)',
        -180,
        180,
        1,
        (v) => {
          this.artRotationRad = degToRad(v);
          this.persist();
          this.redrawPreview();
        },
        'artRot',
      ),
      this.makeSlider(
        'Rotação preview mundo (°)',
        0,
        359,
        1,
        (v) => {
          this.previewWorldRotDeg = v;
          this.redrawPreview();
        },
        'worldRot',
      ),
    );

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;';
    const resetFrame = this.makeSmallBtn('Reset frame');
    resetFrame.addEventListener('click', () => {
      const entry = this.getEntry();
      clearRuntimePoiRotationOverride(entry.typeId, this.getFrame());
      this.reloadFromSelection();
      this.syncControls();
      this.redrawPreview();
      this.refreshExport();
    });
    const resetAll = this.makeSmallBtn('Limpar tudo');
    resetAll.addEventListener('click', () => {
      clearAllRuntimePoiRotationOverrides();
      this.reloadFromSelection();
      this.syncControls();
      this.redrawPreview();
      this.refreshExport();
    });
    const saveBtn = this.makeSmallBtn('Salvar / Exportar', true);
    saveBtn.addEventListener('click', () => this.refreshExport(true));
    btnRow.append(resetFrame, resetAll, saveBtn);

    const exportTitle = document.createElement('div');
    exportTitle.textContent = 'Exportar para o código';
    exportTitle.style.cssText =
      'font-size:11px;font-weight:700;color:#8b949e;text-transform:uppercase;margin-top:4px;';

    this.exportBox = document.createElement('textarea');
    this.exportBox.readOnly = true;
    this.exportBox.rows = 14;
    this.exportBox.style.cssText = [
      'width:100%',
      'box-sizing:border-box',
      'resize:vertical',
      'padding:8px',
      'border-radius:6px',
      'border:1px solid #30363d',
      'background:#0d1117',
      'color:#79c0ff',
      'font:11px/1.4 ui-monospace,Consolas,monospace',
    ].join(';');

    const copyTs = this.makeSmallBtn('Copiar TypeScript');
    copyTs.addEventListener('click', () => this.copyExport('ts'));
    const copyJson = this.makeSmallBtn('Copiar JSON');
    copyJson.addEventListener('click', () => this.copyExport('json'));

    const help = document.createElement('p');
    help.textContent =
      'Cole o TypeScript em src/assets/poiSpriteRotation.ts → POI_SPRITE_ROTATION_OVERRIDES. A rotação extra soma-se à rotação procedural base de cada POI.';
    help.style.cssText = 'font-size:11px;color:#6e7681;line-height:1.4;margin:0;';

    col.append(btnRow, exportTitle, this.exportBox, copyTs, copyJson, help);
    this.refreshExport();
    return col;
  }

  private makeSlider(
    label: string,
    min: number,
    max: number,
    step: number,
    onChange: (v: number) => void,
    id: string,
  ): HTMLLabelElement {
    const wrap = document.createElement('label');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:4px;font-size:12px;color:#c9d1d9;';
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;gap:8px;';
    const title = document.createElement('span');
    title.textContent = label;
    const val = document.createElement('span');
    val.style.cssText = 'font:600 11px ui-monospace,Consolas,monospace;color:#79c0ff;';
    row.append(title, val);
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.style.width = '100%';
    input.addEventListener('input', () => {
      const v = Number(input.value);
      val.textContent = v.toFixed(0);
      onChange(v);
    });
    this.controlEls.set(id, input);
    wrap.append(row, input);
    return wrap;
  }

  private makeSmallBtn(text: string, primary = false): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = text;
    btn.style.cssText = [
      'padding:8px 10px',
      'border-radius:6px',
      'cursor:pointer',
      'font:600 12px Segoe UI,sans-serif',
      primary
        ? 'background:#1f6feb;border:1px solid #3d8bfd;color:#fff;'
        : 'background:#0d1117;border:1px solid #30363d;color:#c9d1d9;',
    ].join(';');
    return btn;
  }

  private syncControls(): void {
    this.setSlider('artRot', radToDeg(this.artRotationRad));
    this.setSlider('worldRot', this.previewWorldRotDeg);
    const entry = this.getEntry();
    const frame = this.getFrame();
    const col = frame % entry.cols;
    const row = Math.floor(frame / entry.cols);
    this.frameLabel.textContent = `${frame} · col ${col} · linha ${row + 1}`;
  }

  private setSlider(id: string, value: number): void {
    const input = this.controlEls.get(id);
    if (!input) return;
    input.value = String(value);
    const wrap = input.closest('label');
    const valEl = wrap?.querySelector('span:last-child');
    if (valEl) valEl.textContent = value.toFixed(0);
  }

  private stepFrame(delta: number): void {
    const entry = this.getEntry();
    this.frameIndex =
      (this.frameIndex + delta + entry.frameCount) % entry.frameCount;
    this.reloadFromSelection();
    this.syncControls();
    this.redrawPreview();
  }

  private reloadFromSelection(): void {
    const entry = this.getEntry();
    const frame = this.getFrame();
    const code = this.codeOverride(entry.typeId, frame);
    const runtime =
      getRuntimePoiRotationOverrides()[`${entry.typeId}:${frame}`]?.artRotation ??
      0;
    this.artRotationRad = code + runtime;
  }

  private persist(): void {
    const entry = this.getEntry();
    const frame = this.getFrame();
    const code = this.codeOverride(entry.typeId, frame);
    saveMergedPoiRotationOverride(entry.typeId, frame, this.artRotationRad - code);
    this.refreshExport();
  }

  private refreshExport(scroll = false): void {
    const overrides = getRuntimePoiRotationOverrides();
    const ts = exportPoiRotationOverridesCode(overrides);
    const json = exportPoiRotationOverridesJson(overrides);
    this.exportBox.value = `${ts}\n\n/* JSON backup */\n${json}`;
    if (scroll) this.exportBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  private copyExport(kind: 'ts' | 'json'): void {
    const overrides = getRuntimePoiRotationOverrides();
    const text =
      kind === 'ts'
        ? exportPoiRotationOverridesCode(overrides)
        : exportPoiRotationOverridesJson(overrides);
    void navigator.clipboard.writeText(text);
  }

  private preloadSheets(): void {
    for (const entry of POI_SPRITE_TUNING_CATALOG) {
      if (this.sheetCache.has(entry.sheetUrl)) continue;
      const img = new Image();
      img.onload = () => {
        this.sheetReady.add(entry.sheetUrl);
        if (entry.typeId === this.getEntry().typeId) this.redrawPreview();
      };
      img.src = entry.sheetUrl;
      this.sheetCache.set(entry.sheetUrl, img);
    }
  }

  private redrawPreview(): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#121820';
    ctx.fillRect(0, 0, w, h);

    const entry = this.getEntry();
    const frame = this.getFrame();
    const col = frame % entry.cols;
    const row = Math.floor(frame / entry.cols);
    const cx = w / 2;
    const cy = h / 2;
    const scale = entry.previewScale;
    const base = entry.baseRotation(POI_TUNING_PREVIEW_SEED);
    const totalRot =
      degToRad(this.previewWorldRotDeg) + base + this.artRotationRad;

    const sheet = this.sheetCache.get(entry.sheetUrl);
    if (sheet && this.sheetReady.has(entry.sheetUrl)) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(totalRot);
      ctx.drawImage(
        sheet,
        col * entry.frameW,
        row * entry.frameH,
        entry.frameW,
        entry.frameH,
        (-entry.frameW * scale) / 2,
        (-entry.frameH * scale) / 2,
        entry.frameW * scale,
        entry.frameH * scale,
      );
      ctx.restore();
    }

    ctx.strokeStyle = 'rgba(88,166,255,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 40, cy);
    ctx.lineTo(cx + 40, cy);
    ctx.moveTo(cx, cy - 40);
    ctx.lineTo(cx, cy + 40);
    ctx.stroke();

    ctx.fillStyle = '#8b949e';
    ctx.font = '11px ui-monospace,Consolas,monospace';
    ctx.fillText(
      `base ${radToDeg(base).toFixed(0)}° + extra ${radToDeg(this.artRotationRad).toFixed(0)}°`,
      12,
      h - 12,
    );
  }
}
