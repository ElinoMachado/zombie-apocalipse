import { ITEMS, itemTooltipText, type ItemId } from '../game/inventory/inventory';
import type { PendingLootItem } from '../game/resources/ResourceManager';

export type LootTakeHandler = (
  uid: string,
  itemId: ItemId,
  qty: number,
) => boolean;

/**
 * Pop-up de itens encontrados após vasculhar.
 * Hover = tooltip; botão direito = inventário.
 */
export class LootResultPopup {
  private root: HTMLDivElement;
  private dieEl: HTMLDivElement;
  private grid: HTMLDivElement;
  private caption: HTMLDivElement;
  private items = new Map<string, PendingLootItem>();
  private onTake: LootTakeHandler | null = null;
  private onClose: (() => void) | null = null;

  constructor() {
    const host = document.getElementById('ui-root');
    if (!host) throw new Error('#ui-root não encontrado');

    this.root = document.createElement('div');
    this.root.style.cssText = [
      'position:absolute',
      'left:50%',
      'top:42%',
      'transform:translate(-50%,-50%)',
      'display:none',
      'flex-direction:column',
      'gap:10px',
      'min-width:260px',
      'max-width:360px',
      'padding:14px 16px',
      'background:rgba(13,17,23,0.95)',
      'border:1px solid #30363d',
      'border-radius:12px',
      'box-shadow:0 16px 40px rgba(0,0,0,0.5)',
      'z-index:25',
      'pointer-events:auto',
      'font:13px Segoe UI,system-ui,sans-serif',
      'color:#e6edf3',
    ].join(';');

    const head = document.createElement('div');
    head.style.cssText =
      'display:flex;justify-content:space-between;align-items:center;gap:12px;';

    const title = document.createElement('div');
    title.textContent = 'Itens encontrados';
    title.style.cssText = 'font-weight:700;font-size:14px;';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = [
      'border:none',
      'background:#21262d',
      'color:#8b949e',
      'width:28px',
      'height:28px',
      'border-radius:6px',
      'cursor:pointer',
      'font-size:14px',
    ].join(';');
    closeBtn.addEventListener('click', () => this.close());

    head.append(title, closeBtn);

    const rollRow = document.createElement('div');
    rollRow.style.cssText =
      'display:flex;align-items:center;gap:10px;color:#8b949e;font-size:11px;';
    const rollLabel = document.createElement('span');
    rollLabel.textContent = 'd20';
    this.dieEl = document.createElement('div');
    this.dieEl.style.cssText = [
      'width:36px',
      'height:36px',
      'border-radius:8px',
      'background:#21262d',
      'border:2px solid #484f58',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'font-weight:800',
      'font-size:16px',
      'color:#ffe082',
    ].join(';');
    rollRow.append(rollLabel, this.dieEl);

    this.caption = document.createElement('div');
    this.caption.style.cssText =
      'font-size:11px;color:#8b949e;line-height:1.35;';
    this.caption.textContent =
      'Passe o rato para ver · botão direito = guardar no inventário';

    this.grid = document.createElement('div');
    this.grid.style.cssText =
      'display:flex;flex-wrap:wrap;gap:8px;min-height:52px;';

    this.root.append(head, rollRow, this.grid, this.caption);
    host.append(this.root);

    this.root.addEventListener('contextmenu', (ev) => ev.preventDefault());
  }

  setHandlers(onTake: LootTakeHandler | null, onClose: (() => void) | null): void {
    this.onTake = onTake;
    this.onClose = onClose;
  }

  get isOpen(): boolean {
    return this.root.style.display === 'flex';
  }

  open(roll: number, items: PendingLootItem[]): void {
    this.items.clear();
    for (const it of items) this.items.set(it.uid, it);
    this.dieEl.textContent = String(roll);
    this.renderGrid();
    this.root.style.display = 'flex';
  }

  close(): void {
    this.root.style.display = 'none';
    this.items.clear();
    this.grid.replaceChildren();
    this.onClose?.();
  }

  /** Remove item da grelha após take com sucesso. */
  removeItem(uid: string): void {
    this.items.delete(uid);
    this.renderGrid();
    if (this.items.size === 0) this.close();
  }

  hide(): void {
    this.close();
  }

  destroy(): void {
    this.onTake = null;
    this.onClose = null;
    this.root.remove();
  }

  private renderGrid(): void {
    this.grid.replaceChildren();
    for (const it of this.items.values()) {
      this.grid.append(this.makeItemEl(it));
    }
  }

  private makeItemEl(it: PendingLootItem): HTMLDivElement {
    const def = ITEMS[it.itemId];
    const hex = `#${def.color.toString(16).padStart(6, '0')}`;
    const el = document.createElement('div');
    el.dataset.uid = it.uid;
    el.title = `${itemTooltipText(def, it.qty)}\n(d20=${it.roll})\nBotão direito: guardar no inventário`;
    el.style.cssText = [
      'width:52px',
      'height:52px',
      'border-radius:8px',
      'background:#161b22',
      `border:2px solid ${hex}`,
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'justify-content:center',
      'gap:3px',
      'cursor:default',
      'position:relative',
      'user-select:none',
    ].join(';');

    const sw = document.createElement('div');
    sw.style.cssText = `width:18px;height:18px;border-radius:4px;background:${hex};`;
    const name = document.createElement('span');
    name.textContent = def.label;
    name.style.cssText =
      'font-size:8px;color:#c9d1d9;max-width:48px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';

    el.append(sw, name);

    el.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const ok = this.onTake?.(it.uid, it.itemId, it.qty) ?? false;
      if (ok) this.removeItem(it.uid);
    });

    return el;
  }
}
