import { formatGameNumber } from '../game/formatNumbers';
import type { Inventory } from '../game/inventory/inventory';
import {
  ITEMS,
  INVENTORY_SLOTS,
  MAX_CARRY_WEIGHT,
  itemTooltipText,
  type ItemId,
} from '../game/inventory/inventory';

export type InventoryItemActionHandler = (slotIndex: number) => boolean;

/** Inventário — centro inferior: peso + 8 slots (botão direito = usar/equipar). */
export class InventoryHud {
  private root: HTMLDivElement;
  private weightLabel: HTMLSpanElement;
  private slotEls: HTMLDivElement[] = [];
  private qtyEls: HTMLSpanElement[] = [];
  private swatchEls: HTMLDivElement[] = [];
  private nameEls: HTMLSpanElement[] = [];
  private tooltip: HTMLDivElement;
  private onItemAction: InventoryItemActionHandler | null = null;

  constructor() {
    const host = document.getElementById('ui-root');
    if (!host) throw new Error('#ui-root não encontrado');

    this.root = document.createElement('div');
    this.root.style.cssText = [
      'position:absolute',
      'left:50%',
      'bottom:12px',
      'transform:translateX(-50%)',
      'display:none',
      'flex-direction:column',
      'align-items:center',
      'gap:6px',
      'z-index:26',
      'pointer-events:none',
      'font:12px Segoe UI,system-ui,sans-serif',
      'color:#e6edf3',
    ].join(';');

    this.weightLabel = document.createElement('span');
    this.weightLabel.style.cssText = [
      'padding:3px 10px',
      'border-radius:999px',
      'background:rgba(13,17,23,0.92)',
      'border:1px solid #30363d',
      'font-variant-numeric:tabular-nums',
      'font-weight:700',
      'font-size:11px',
      'color:#8b949e',
      'letter-spacing:0.02em',
    ].join(';');
    this.weightLabel.textContent = `Peso 0/${MAX_CARRY_WEIGHT}`;

    const bar = document.createElement('div');
    bar.style.cssText = [
      'display:flex',
      'gap:6px',
      'padding:8px 10px',
      'background:rgba(13,17,23,0.92)',
      'border:1px solid #30363d',
      'border-radius:10px',
      'box-shadow:0 8px 24px rgba(0,0,0,0.35)',
      'pointer-events:auto',
    ].join(';');

    this.tooltip = document.createElement('div');
    this.tooltip.style.cssText = [
      'position:absolute',
      'left:50%',
      'bottom:calc(100% + 10px)',
      'transform:translateX(-50%)',
      'display:none',
      'width:220px',
      'padding:10px 12px',
      'background:rgba(13,17,23,0.96)',
      'border:1px solid #30363d',
      'border-radius:8px',
      'box-shadow:0 10px 28px rgba(0,0,0,0.45)',
      'pointer-events:none',
      'z-index:30',
      'text-align:left',
    ].join(';');

    for (let i = 0; i < INVENTORY_SLOTS; i += 1) {
      const slot = document.createElement('div');
      slot.style.cssText = [
        'position:relative',
        'width:44px',
        'height:44px',
        'border-radius:8px',
        'background:#161b22',
        'border:1px solid #30363d',
        'display:flex',
        'flex-direction:column',
        'align-items:center',
        'justify-content:center',
        'gap:2px',
        'overflow:hidden',
        'cursor:default',
      ].join(';');

      slot.addEventListener('mouseenter', () => {
        const itemId = slot.dataset.itemId as ItemId | undefined;
        const qty = Number(slot.dataset.qty ?? '0');
        if (!itemId || !ITEMS[itemId]) {
          this.hideTooltip();
          return;
        }
        this.showTooltip(ITEMS[itemId], qty);
      });
      slot.addEventListener('mouseleave', () => this.hideTooltip());

      slot.addEventListener('contextmenu', (ev) => {
        ev.preventDefault();
        const idx = this.slotEls.indexOf(slot);
        if (idx >= 0 && slot.dataset.itemId) {
          this.onItemAction?.(idx);
        }
      });

      const swatch = document.createElement('div');
      swatch.style.cssText = [
        'width:14px',
        'height:14px',
        'border-radius:4px',
        'background:transparent',
        'border:1px solid transparent',
      ].join(';');

      const name = document.createElement('span');
      name.style.cssText = [
        'font-size:8px',
        'line-height:1',
        'color:#8b949e',
        'max-width:40px',
        'text-align:center',
        'white-space:nowrap',
        'overflow:hidden',
        'text-overflow:ellipsis',
      ].join(';');

      const qty = document.createElement('span');
      qty.style.cssText = [
        'position:absolute',
        'right:3px',
        'bottom:2px',
        'font-size:10px',
        'font-weight:800',
        'font-variant-numeric:tabular-nums',
        'color:#e6edf3',
        'text-shadow:0 1px 2px #0d1117',
      ].join(';');

      slot.append(swatch, name, qty);
      bar.append(slot);
      this.slotEls.push(slot);
      this.swatchEls.push(swatch);
      this.nameEls.push(name);
      this.qtyEls.push(qty);
    }

    this.root.append(this.tooltip, this.weightLabel, bar);
    host.append(this.root);
  }

  setItemActionHandler(fn: InventoryItemActionHandler | null): void {
    this.onItemAction = fn;
  }

  show(): void {
    this.root.style.display = 'flex';
  }

  hide(): void {
    this.hideTooltip();
    this.root.style.display = 'none';
  }

  sync(inv: Inventory): void {
    const w = inv.totalWeight;
    const max = inv.maxWeight;
    this.weightLabel.textContent = `Peso ${formatGameNumber(w)}/${formatGameNumber(max)}`;
    this.weightLabel.style.color =
      w >= max ? '#ff8a80' : w >= max * 0.75 ? '#ffe082' : '#8b949e';

    for (let i = 0; i < INVENTORY_SLOTS; i += 1) {
      const slot = inv.slots[i] ?? null;
      const sw = this.swatchEls[i]!;
      const name = this.nameEls[i]!;
      const qty = this.qtyEls[i]!;
      const box = this.slotEls[i]!;

      if (!slot) {
        sw.style.background = 'transparent';
        sw.style.borderColor = 'transparent';
        name.textContent = '';
        qty.textContent = '';
        box.style.borderColor = '#30363d';
        delete box.dataset.itemId;
        delete box.dataset.qty;
        box.title = '';
        continue;
      }

      const def = ITEMS[slot.itemId];
      const hex = `#${def.color.toString(16).padStart(6, '0')}`;
      sw.style.background = hex;
      sw.style.borderColor = '#0d1117';
      name.textContent = def.label;
      qty.textContent = slot.qty > 1 ? String(slot.qty) : '';
      box.style.borderColor = hex;
      box.dataset.itemId = slot.itemId;
      box.dataset.qty = String(slot.qty);
      box.title = `${itemTooltipText(def, slot.qty)}\nBotão direito: usar/equipar`;
    }
  }

  destroy(): void {
    this.onItemAction = null;
    this.root.remove();
  }

  private showTooltip(
    def: (typeof ITEMS)[ItemId],
    qty: number,
  ): void {
    const hex = `#${def.color.toString(16).padStart(6, '0')}`;
    const lines = itemTooltipText(def, qty).split('\n');
    const desc = lines.pop() ?? '';
    const meta = lines.join(' · ');
    this.tooltip.innerHTML = [
      `<div style="font-weight:700;font-size:13px;color:${hex};margin-bottom:4px">${def.label}${qty > 1 ? ` ×${qty}` : ''}</div>`,
      `<div style="font-size:10px;color:#8b949e;margin-bottom:6px">${meta}</div>`,
      `<div style="font-size:11px;line-height:1.4;color:#c9d1d9">${desc}</div>`,
    ].join('');
    this.tooltip.style.display = 'block';
  }

  private hideTooltip(): void {
    this.tooltip.style.display = 'none';
  }
}
