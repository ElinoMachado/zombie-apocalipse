import { TILE_SIZE } from '../assets/manifest';
import {
  WRECKED_CAR_COLS,
  WRECKED_CAR_FRAME_H,
  WRECKED_CAR_FRAME_W,
  carObbWorldCorners,
  listWreckedCarFrames,
  wreckedCarCollisionObb,
  wreckedCarDisplayScale,
  wreckedCarFrameCollisionProfile,
  wreckedCarFrameCollisionProfileBase,
  wreckedCarFrameRow,
  type WreckedCarFrameCollisionProfile,
} from '../assets/wreckedCars';
import {
  clearAllRuntimeProfileOverrides,
  clearRuntimeProfileOverride,
  exportProfileOverridesCode,
  exportProfileOverridesJson,
  getRuntimeProfileOverrides,
  saveMergedAsRuntimeOverride,
} from '../game/dev/wreckedCarProfileOverrides';

const SHEET_URL = 'assets/props/wrecked_cars_sheet.png?v=3';
const PREVIEW_SCALE = 2.4;

export interface SpriteTuningHandlers {
  onClose: () => void;
}

/** Ferramenta dev — ajuste manual de hitboxes de carros abandonados. */
export class SpriteTuningHud {
  private readonly root: HTMLDivElement;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private frameLabel!: HTMLSpanElement;
  private exportBox!: HTMLTextAreaElement;
  private readonly sheet = new Image();
  private sheetReady = false;
  private frames = [...listWreckedCarFrames()];
  private frameIndex = 0;
  private worldRotationDeg = 0;
  private merged: WreckedCarFrameCollisionProfile;
  private dragging = false;
  private dragStart = { x: 0, y: 0 };
  private dragProfileStart = { localOffsetX: 0, localOffsetY: 0 };
  private readonly controlEls = new Map<string, HTMLInputElement>();

  constructor(handlers: SpriteTuningHandlers) {
    this.merged = wreckedCarFrameCollisionProfile(this.getFrame());

    this.root = document.createElement('div');
    this.root.id = 'sprite-tuning';
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
    hTitle.textContent = 'Sprites — carros abandonados (hitbox)';
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

    const frameCol = this.buildFrameColumn();
    const previewCol = this.buildPreviewColumn();
    const controlCol = this.buildControlColumn();

    body.append(frameCol, previewCol, controlCol);
    this.root.append(header, body);
    document.body.append(this.root);

    this.sheet.onload = () => {
      this.sheetReady = true;
      this.redrawPreview();
    };
    this.sheet.src = SHEET_URL;

    this.reloadMergedFromFrame();
    this.syncControlsFromMerged();
    this.redrawPreview();
  }

  destroy(): void {
    this.root.remove();
  }

  private getFrame(): number {
    return this.frames[this.frameIndex] ?? this.frames[0] ?? 28;
  }

  private buildFrameColumn(): HTMLDivElement {
    const col = document.createElement('div');
    col.style.cssText =
      'display:flex;flex-direction:column;gap:8px;overflow:auto;border:1px solid #30363d;border-radius:8px;padding:8px;background:#161b22;';

    const label = document.createElement('div');
    label.textContent = 'Frames';
    label.style.cssText = 'font-size:11px;color:#8b949e;font-weight:700;text-transform:uppercase;';

    const nav = document.createElement('div');
    nav.style.cssText = 'display:flex;gap:6px;';
    const prev = document.createElement('button');
    prev.type = 'button';
    prev.textContent = '◀';
    const next = document.createElement('button');
    next.type = 'button';
    next.textContent = '▶';
    for (const b of [prev, next]) {
      b.style.cssText =
        'flex:1;padding:6px;border-radius:6px;border:1px solid #30363d;background:#0d1117;color:#c9d1d9;cursor:pointer;';
    }
    prev.addEventListener('click', () => this.stepFrame(-1));
    next.addEventListener('click', () => this.stepFrame(1));
    nav.append(prev, next);

    this.frameLabel = document.createElement('span');
    this.frameLabel.style.cssText =
      'font:11px ui-monospace,Consolas,monospace;color:#8b949e;';

    const list = document.createElement('div');
    list.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
    for (let i = 0; i < this.frames.length; i += 1) {
      const frame = this.frames[i]!;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = `#${frame} · linha ${wreckedCarFrameRow(frame) + 1}`;
      btn.dataset.index = String(i);
      btn.style.cssText =
        'text-align:left;padding:6px 8px;border-radius:6px;border:1px solid transparent;background:transparent;color:#c9d1d9;cursor:pointer;font:12px Segoe UI,sans-serif;';
      btn.addEventListener('click', () => {
        this.frameIndex = i;
        this.reloadMergedFromFrame();
        this.syncControlsFromMerged();
        this.redrawPreview();
        this.highlightFrameButtons(list);
      });
      list.append(btn);
    }
    this.highlightFrameButtons(list);

    col.append(label, nav, this.frameLabel, list);
    return col;
  }

  private highlightFrameButtons(list: HTMLDivElement): void {
    for (const el of list.querySelectorAll('button')) {
      const idx = Number(el.dataset.index);
      const active = idx === this.frameIndex;
      el.style.background = active ? '#1f6feb33' : 'transparent';
      el.style.borderColor = active ? '#58a6ff' : 'transparent';
    }
    const frame = this.getFrame();
    this.frameLabel.textContent = `frame ${frame} · col ${frame % WRECKED_CAR_COLS} · linha ${wreckedCarFrameRow(frame) + 1}`;
  }

  private buildPreviewColumn(): HTMLDivElement {
    const col = document.createElement('div');
    col.style.cssText =
      'display:flex;flex-direction:column;align-items:center;gap:8px;min-width:0;';

    const hint = document.createElement('div');
    hint.textContent = 'Arraste no canvas para mover o centro da hitbox';
    hint.style.cssText = 'font-size:12px;color:#8b949e;';

    this.canvas = document.createElement('canvas');
    this.canvas.width = 420;
    this.canvas.height = 420;
    this.canvas.style.cssText =
      'width:100%;max-width:420px;aspect-ratio:1;border-radius:10px;border:1px solid #30363d;background:#010409;cursor:grab;touch-action:none;';
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D indisponível');
    this.ctx = ctx;

    this.canvas.addEventListener('pointerdown', (ev) => {
      this.dragging = true;
      this.canvas.style.cursor = 'grabbing';
      this.dragStart = { x: ev.clientX, y: ev.clientY };
      this.dragProfileStart = {
        localOffsetX: this.merged.localOffsetX,
        localOffsetY: this.merged.localOffsetY,
      };
      this.canvas.setPointerCapture(ev.pointerId);
    });
    this.canvas.addEventListener('pointermove', (ev) => {
      if (!this.dragging) return;
      const dx = ev.clientX - this.dragStart.x;
      const dy = ev.clientY - this.dragStart.y;
      const scale = wreckedCarDisplayScale(TILE_SIZE) * PREVIEW_SCALE;
      const rot = degToRad(this.worldRotationDeg + radToDeg(this.merged.artRotation));
      const cos = Math.cos(-rot);
      const sin = Math.sin(-rot);
      const lx = (dx * cos - dy * sin) / (WRECKED_CAR_FRAME_W * scale);
      const ly = (dx * sin + dy * cos) / (WRECKED_CAR_FRAME_H * scale);
      this.merged.localOffsetX = this.dragProfileStart.localOffsetX + lx;
      this.merged.localOffsetY = this.dragProfileStart.localOffsetY + ly;
      this.persistMerged();
      this.syncControlsFromMerged(false);
      this.redrawPreview();
    });
    const stopDrag = () => {
      this.dragging = false;
      this.canvas.style.cursor = 'grab';
    };
    this.canvas.addEventListener('pointerup', stopDrag);
    this.canvas.addEventListener('pointercancel', stopDrag);

    col.append(hint, this.canvas);
    return col;
  }

  private buildControlColumn(): HTMLDivElement {
    const col = document.createElement('div');
    col.style.cssText =
      'display:flex;flex-direction:column;gap:10px;overflow:auto;border:1px solid #30363d;border-radius:8px;padding:10px;background:#161b22;';

    col.append(
      this.makeSlider(
        'Rotação preview (°)',
        0,
        360,
        1,
        (v) => {
          this.worldRotationDeg = v;
          this.redrawPreview();
        },
        'worldRot',
      ),
      this.makeCheckbox('Trocar eixos (swapAxes)', (v) => {
        this.merged.swapAxes = v;
        this.persistMerged();
        this.redrawPreview();
      }, 'swapAxes'),
      this.makeSlider(
        'Rotação extra hitbox (°)',
        -180,
        180,
        1,
        (v) => {
          this.merged.artRotation = degToRad(v);
          this.persistMerged();
          this.redrawPreview();
        },
        'artRot',
      ),
      this.makeSlider(
        'Offset X (fração)',
        -0.25,
        0.25,
        0.005,
        (v) => {
          this.merged.localOffsetX = v;
          this.persistMerged();
          this.redrawPreview();
        },
        'offX',
      ),
      this.makeSlider(
        'Offset Y (fração)',
        -0.25,
        0.25,
        0.005,
        (v) => {
          this.merged.localOffsetY = v;
          this.persistMerged();
          this.redrawPreview();
        },
        'offY',
      ),
    );

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;';
    const resetFrame = this.makeSmallBtn('Reset frame');
    resetFrame.addEventListener('click', () => {
      clearRuntimeProfileOverride(this.getFrame());
      this.reloadMergedFromFrame();
      this.syncControlsFromMerged();
      this.redrawPreview();
      this.refreshExport();
    });
    const resetAll = this.makeSmallBtn('Limpar tudo');
    resetAll.addEventListener('click', () => {
      clearAllRuntimeProfileOverrides();
      this.reloadMergedFromFrame();
      this.syncControlsFromMerged();
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
      'Cole o TypeScript em src/assets/wreckedCars.ts → WRECKED_CAR_FRAME_OVERRIDES e regenere a cidade.';
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
    wrap.style.cssText =
      'display:flex;flex-direction:column;gap:4px;font-size:12px;color:#8b949e;';
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;gap:8px;';
    const name = document.createElement('span');
    name.textContent = label;
    const val = document.createElement('span');
    val.style.cssText = 'font-family:ui-monospace,Consolas,monospace;color:#c9d1d9;';
    row.append(name, val);
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.style.width = '100%';
    input.addEventListener('input', () => {
      const n = Number(input.value);
      val.textContent = n.toFixed(step < 0.01 ? 3 : 0);
      onChange(n);
    });
    this.controlEls.set(id, input);
    wrap.append(row, input);
    wrap.dataset.valueId = id;
    return wrap;
  }

  private makeCheckbox(
    label: string,
    onChange: (v: boolean) => void,
    id: string,
  ): HTMLLabelElement {
    const wrap = document.createElement('label');
    wrap.style.cssText =
      'display:flex;align-items:center;gap:8px;font-size:12px;color:#c9d1d9;cursor:pointer;';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.addEventListener('change', () => onChange(input.checked));
    this.controlEls.set(id, input as unknown as HTMLInputElement);
    wrap.append(input, document.createTextNode(label));
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
    ].join('');
    return btn;
  }

  private syncControlsFromMerged(updateWorldRot = true): void {
    const swap = this.controlEls.get('swapAxes') as HTMLInputElement | undefined;
    if (swap) swap.checked = this.merged.swapAxes;
    this.setSlider('artRot', radToDeg(this.merged.artRotation));
    this.setSlider('offX', this.merged.localOffsetX);
    this.setSlider('offY', this.merged.localOffsetY);
    if (updateWorldRot) this.setSlider('worldRot', this.worldRotationDeg);
  }

  private setSlider(id: string, value: number): void {
    const input = this.controlEls.get(id);
    if (!input) return;
    input.value = String(value);
    const wrap = input.closest('label');
    const valEl = wrap?.querySelector('span:last-child');
    if (valEl) {
      valEl.textContent = value.toFixed(id === 'offX' || id === 'offY' ? 3 : 0);
    }
  }

  private stepFrame(delta: number): void {
    this.frameIndex = (this.frameIndex + delta + this.frames.length) % this.frames.length;
    this.reloadMergedFromFrame();
    this.syncControlsFromMerged();
    this.redrawPreview();
  }

  private reloadMergedFromFrame(): void {
    this.merged = { ...wreckedCarFrameCollisionProfile(this.getFrame()) };
  }

  private persistMerged(): void {
    const frame = this.getFrame();
    const base = wreckedCarFrameCollisionProfileBase(frame);
    saveMergedAsRuntimeOverride(frame, base, this.merged);
    this.refreshExport();
  }

  private refreshExport(scroll = false): void {
    const overrides = getRuntimeProfileOverrides();
    const ts = exportProfileOverridesCode(overrides);
    const json = exportProfileOverridesJson(overrides);
    this.exportBox.value = `${ts}\n\n/* JSON backup */\n${json}`;
    if (scroll) this.exportBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  private copyExport(kind: 'ts' | 'json'): void {
    const overrides = getRuntimeProfileOverrides();
    const text =
      kind === 'ts'
        ? exportProfileOverridesCode(overrides)
        : exportProfileOverridesJson(overrides);
    void navigator.clipboard.writeText(text);
  }

  private redrawPreview(): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#121820';
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const frame = this.getFrame();
    const col = frame % WRECKED_CAR_COLS;
    const row = wreckedCarFrameRow(frame);
    const scale = wreckedCarDisplayScale(TILE_SIZE) * PREVIEW_SCALE;
    const worldRot = degToRad(this.worldRotationDeg);

    if (this.sheetReady) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(worldRot);
      ctx.drawImage(
        this.sheet,
        col * WRECKED_CAR_FRAME_W,
        row * WRECKED_CAR_FRAME_H,
        WRECKED_CAR_FRAME_W,
        WRECKED_CAR_FRAME_H,
        (-WRECKED_CAR_FRAME_W * scale) / 2,
        (-WRECKED_CAR_FRAME_H * scale) / 2,
        WRECKED_CAR_FRAME_W * scale,
        WRECKED_CAR_FRAME_H * scale,
      );
      ctx.restore();
    }

    const obb = wreckedCarCollisionObb(cx, cy, TILE_SIZE, worldRot, 1, frame);
    const corners = carObbWorldCorners(obb);
    ctx.beginPath();
    for (let i = 0; i < corners.length; i += 1) {
      const p = corners[i]!;
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,92,170,0.18)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,92,170,0.95)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#58a6ff';
    ctx.beginPath();
    ctx.arc(obb.cx, obb.cy, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function degToRad(d: number): number {
  return (d * Math.PI) / 180;
}

function radToDeg(r: number): number {
  return (r * 180) / Math.PI;
}
