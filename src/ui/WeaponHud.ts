import type { EquipmentLoadout } from '../game/inventory/equipmentLoadout';
import { ITEMS } from '../game/inventory/inventory';
import {
  meleeDurabilityRatio,
  rangedAmmoLabel,
  reloadProgress,
  type ReloadState,
  type WeaponInstance,
} from '../game/combat/weapons';

export type WeaponQuickSlotId = 'primary' | 'secondary';

export type QuickSlotUnequipHandler = (quickSlot: WeaponQuickSlotId) => boolean;

/** HUD de vida + estamina + slots rápidos de arma (LMB/RMB). */
export class WeaponHud {
  private root: HTMLDivElement;
  private hpLabel!: HTMLSpanElement;
  private hpBar!: HTMLDivElement;
  private staminaLabel!: HTMLSpanElement;
  private staminaBar!: HTMLDivElement;
  private xpBlock!: HTMLDivElement;
  private xpLabel!: HTMLSpanElement;
  private xpBar!: HTMLDivElement;
  private primaryStat!: HTMLDivElement;
  private reloadBarTrack!: HTMLDivElement;
  private reloadBar!: HTMLDivElement;
  private secondaryStat!: HTMLDivElement;
  private secondaryBarTrack!: HTMLDivElement;
  private secondaryBar!: HTMLDivElement;
  private quickSlotEls: Record<WeaponQuickSlotId, HTMLDivElement> = {
    primary: null!,
    secondary: null!,
  };
  private quickNameEls: Record<WeaponQuickSlotId, HTMLSpanElement> = {
    primary: null!,
    secondary: null!,
  };
  private onQuickUnequip: QuickSlotUnequipHandler | null = null;

  constructor() {
    const host = document.getElementById('ui-root');
    if (!host) throw new Error('#ui-root não encontrado');

    this.root = document.createElement('div');
    this.root.style.cssText = [
      'position:absolute',
      'left:12px',
      'bottom:12px',
      'display:none',
      'flex-direction:row',
      'align-items:stretch',
      'gap:10px',
      'z-index:5',
      'pointer-events:none',
      'font:12px Segoe UI,system-ui,sans-serif',
      'color:#e6edf3',
    ].join(';');

    const statsPanel = document.createElement('div');
    statsPanel.style.cssText = [
      'display:flex',
      'flex-direction:column',
      'gap:8px',
      'min-width:168px',
      'padding:10px 12px',
      'background:rgba(13,17,23,0.9)',
      'border:1px solid #30363d',
      'border-radius:8px',
      'box-shadow:0 8px 24px rgba(0,0,0,0.35)',
    ].join(';');

    statsPanel.append(
      this.buildHpBlock(),
      this.buildStaminaBlock(),
      this.buildXpBlock(),
    );

    const quickPanel = document.createElement('div');
    quickPanel.style.cssText =
      'display:flex;gap:8px;align-items:stretch;align-self:stretch;';

    const primaryCol = this.buildQuickSlot('primary', 'LMB', 'Botão esquerdo');
    this.primaryStat = document.createElement('div');
    this.primaryStat.style.cssText =
      'font-size:11px;font-weight:700;font-variant-numeric:tabular-nums;color:#ffe082;margin-top:4px;min-height:16px;line-height:16px;';
    this.reloadBarTrack = document.createElement('div');
    this.reloadBarTrack.style.cssText = [
      'margin-top:3px',
      'width:100%',
      'height:4px',
      'background:#21262d',
      'border-radius:2px',
      'overflow:hidden',
      'display:none',
    ].join(';');
    this.reloadBar = document.createElement('div');
    this.reloadBar.style.cssText =
      'height:100%;width:0%;background:#ffe082;border-radius:2px;';
    this.reloadBarTrack.append(this.reloadBar);
    primaryCol.append(this.primaryStat, this.reloadBarTrack);

    const secondaryCol = this.buildQuickSlot(
      'secondary',
      'RMB',
      'Botão direito',
    );
    this.secondaryStat = document.createElement('div');
    this.secondaryStat.style.cssText =
      'font-size:11px;font-weight:700;font-variant-numeric:tabular-nums;color:#f0f6fc;margin-top:4px;min-height:16px;line-height:16px;';
    this.secondaryBarTrack = document.createElement('div');
    this.secondaryBarTrack.style.cssText = [
      'margin-top:3px',
      'width:100%',
      'height:4px',
      'background:#21262d',
      'border-radius:2px',
      'overflow:hidden',
    ].join(';');
    this.secondaryBar = document.createElement('div');
    this.secondaryBar.style.cssText = [
      'height:100%',
      'width:100%',
      'background:#f0f6fc',
      'border-radius:2px',
      'transition:width 80ms linear',
    ].join(';');
    this.secondaryBarTrack.append(this.secondaryBar);
    secondaryCol.append(this.secondaryStat, this.secondaryBarTrack);

    quickPanel.append(primaryCol, secondaryCol);
    this.root.append(statsPanel, quickPanel);
    host.append(this.root);
  }

  private buildHpBlock(): HTMLDivElement {
    const hpBlock = document.createElement('div');
    hpBlock.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
    const hpHead = document.createElement('div');
    hpHead.style.cssText =
      'display:flex;justify-content:space-between;align-items:baseline;color:#8b949e;font-size:11px;';
    const hpTitle = document.createElement('span');
    hpTitle.textContent = 'Vida';
    hpTitle.style.cssText = 'color:#e6edf3;font-weight:600';
    this.hpLabel = document.createElement('span');
    this.hpLabel.style.cssText =
      'font-variant-numeric:tabular-nums;font-weight:700;color:#ff8a80';
    hpHead.append(hpTitle, this.hpLabel);
    const hpTrack = document.createElement('div');
    hpTrack.style.cssText =
      'width:100%;height:8px;background:#21262d;border-radius:4px;overflow:hidden;';
    this.hpBar = document.createElement('div');
    this.hpBar.style.cssText =
      'height:100%;width:100%;background:linear-gradient(90deg,#e53935,#ff7043);border-radius:4px;transition:width 80ms linear;';
    hpTrack.append(this.hpBar);
    hpBlock.append(hpHead, hpTrack);
    return hpBlock;
  }

  private buildStaminaBlock(): HTMLDivElement {
    const stamBlock = document.createElement('div');
    stamBlock.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
    const stamHead = document.createElement('div');
    stamHead.style.cssText =
      'display:flex;justify-content:space-between;align-items:baseline;color:#8b949e;font-size:11px;';
    const stamTitle = document.createElement('span');
    stamTitle.textContent = 'Estamina';
    stamTitle.style.cssText = 'color:#e6edf3;font-weight:600';
    this.staminaLabel = document.createElement('span');
    this.staminaLabel.style.cssText =
      'font-variant-numeric:tabular-nums;font-weight:700;color:#7ee787';
    stamHead.append(stamTitle, this.staminaLabel);
    const stamTrack = document.createElement('div');
    stamTrack.style.cssText =
      'width:100%;height:7px;background:#21262d;border-radius:4px;overflow:hidden;';
    this.staminaBar = document.createElement('div');
    this.staminaBar.style.cssText =
      'height:100%;width:100%;background:linear-gradient(90deg,#238636,#3fb950);border-radius:4px;transition:width 60ms linear;';
    stamTrack.append(this.staminaBar);
    stamBlock.append(stamHead, stamTrack);
    return stamBlock;
  }

  private buildXpBlock(): HTMLDivElement {
    this.xpBlock = document.createElement('div');
    this.xpBlock.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
    const xpHead = document.createElement('div');
    xpHead.style.cssText =
      'display:flex;justify-content:space-between;align-items:baseline;color:#8b949e;font-size:11px;';
    const xpTitle = document.createElement('span');
    xpTitle.textContent = 'Nível';
    xpTitle.style.cssText = 'color:#e6edf3;font-weight:600';
    this.xpLabel = document.createElement('span');
    this.xpLabel.style.cssText =
      'font-variant-numeric:tabular-nums;font-weight:700;color:#a371f7';
    xpHead.append(xpTitle, this.xpLabel);
    const xpTrack = document.createElement('div');
    xpTrack.style.cssText =
      'width:100%;height:6px;background:#21262d;border-radius:4px;overflow:hidden;';
    this.xpBar = document.createElement('div');
    this.xpBar.style.cssText =
      'height:100%;width:0%;background:linear-gradient(90deg,#8957e5,#a371f7);border-radius:4px;transition:width 80ms linear;';
    xpTrack.append(this.xpBar);
    this.xpBlock.append(xpHead, xpTrack);
    return this.xpBlock;
  }

  private buildQuickSlot(
    id: WeaponQuickSlotId,
    bindLabel: string,
    bindHint: string,
  ): HTMLDivElement {
    const col = document.createElement('div');
    col.style.cssText = [
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'justify-content:flex-start',
      'gap:4px',
      'width:84px',
      'min-height:100%',
      'padding:10px 12px',
      'background:rgba(13,17,23,0.9)',
      'border:1px solid #30363d',
      'border-radius:8px',
      'box-shadow:0 8px 24px rgba(0,0,0,0.35)',
      'pointer-events:auto',
      'box-sizing:border-box',
    ].join(';');

    const bindBadge = document.createElement('div');
    bindBadge.textContent = bindLabel;
    bindBadge.title = bindHint;
    bindBadge.style.cssText = [
      'font-size:10px',
      'font-weight:800',
      'letter-spacing:0.06em',
      'padding:2px 8px',
      'border-radius:999px',
      'background:rgba(88,166,255,0.18)',
      'border:1px solid #388bfd',
      'color:#58a6ff',
    ].join(';');

    const slot = document.createElement('div');
    slot.dataset.quickSlot = id;
    slot.style.cssText = [
      'position:relative',
      'width:52px',
      'height:52px',
      'flex:0 0 52px',
      'border-radius:8px',
      'background:#161b22',
      'border:2px dashed #484f58',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'justify-content:center',
      'gap:3px',
      'cursor:default',
      'user-select:none',
    ].join(';');
    slot.title = `${bindHint}\nBotão direito: guardar no inventário`;

    const name = document.createElement('span');
    name.style.cssText =
      'font-size:8px;color:#8b949e;max-width:52px;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    name.textContent = 'vazio';
    slot.append(name);

    slot.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();
      this.onQuickUnequip?.(id);
    });

    col.append(bindBadge, slot);
    this.quickSlotEls[id] = slot;
    this.quickNameEls[id] = name;
    return col;
  }

  setQuickUnequipHandler(fn: QuickSlotUnequipHandler | null): void {
    this.onQuickUnequip = fn;
  }

  show(): void {
    this.root.style.display = 'flex';
  }

  hide(): void {
    this.root.style.display = 'none';
  }

  syncQuickSlots(loadout: EquipmentLoadout): void {
    for (const id of ['primary', 'secondary'] as const) {
      const itemId = loadout.get(id);
      const slot = this.quickSlotEls[id];
      const name = this.quickNameEls[id];
      if (!itemId) {
        delete slot.dataset.itemId;
        slot.style.borderColor = '#484f58';
        slot.style.borderStyle = 'dashed';
        name.textContent = 'vazio';
        name.style.color = '#8b949e';
        continue;
      }
      const def = ITEMS[itemId];
      const hex = `#${def.color.toString(16).padStart(6, '0')}`;
      slot.dataset.itemId = itemId;
      slot.style.borderColor = hex;
      slot.style.borderStyle = 'solid';
      name.textContent = def.label;
      name.style.color = '#c9d1d9';
    }
  }

  sync(
    primary: WeaponInstance | null,
    secondary: WeaponInstance | null,
    reload: ReloadState | undefined,
    loadout: EquipmentLoadout,
    hp: number,
    maxHp: number,
    stamina: number,
    maxStamina: number,
    level = 1,
    xp = 0,
    xpNeed = 0,
    xpProgress = 0,
  ): void {
    this.syncQuickSlots(loadout);

    this.hpLabel.textContent = `${Math.max(0, Math.ceil(hp))}/${maxHp}`;
    const hpRatio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
    this.hpBar.style.width = `${(hpRatio * 100).toFixed(1)}%`;

    this.staminaLabel.textContent = `${Math.max(0, Math.ceil(stamina))}/${maxStamina}`;
    const stamRatio =
      maxStamina > 0 ? Math.max(0, Math.min(1, stamina / maxStamina)) : 0;
    this.staminaBar.style.width = `${(stamRatio * 100).toFixed(1)}%`;
    this.staminaBar.style.opacity = stamRatio < 0.15 ? '0.45' : '1';

    if (xpNeed <= 0) {
      this.xpLabel.textContent = `${level} · MAX`;
      this.xpBar.style.width = '100%';
    } else {
      this.xpLabel.textContent = `${level} · ${xp}/${xpNeed} XP`;
      this.xpBar.style.width = `${(xpProgress * 100).toFixed(1)}%`;
    }

    if (!primary || !loadout.equippedPrimary()) {
      this.primaryStat.textContent = '—';
      this.primaryStat.style.color = '#484f58';
      this.reloadBarTrack.style.display = 'block';
      this.reloadBar.style.width = '0%';
    } else if (reload?.active) {
      this.primaryStat.textContent = 'Recarregando…';
      this.primaryStat.style.color = '#8b949e';
      this.reloadBarTrack.style.display = 'block';
      this.reloadBar.style.width = `${(reloadProgress(reload) * 100).toFixed(1)}%`;
    } else {
      this.primaryStat.textContent = rangedAmmoLabel(primary);
      this.primaryStat.style.color = '#ffe082';
      this.reloadBarTrack.style.display = 'block';
      this.reloadBar.style.width = '0%';
    }

    if (!secondary || !loadout.equippedSecondary()) {
      this.secondaryStat.textContent = '—';
      this.secondaryStat.style.color = '#484f58';
      this.secondaryBar.style.width = '0%';
      this.secondaryBar.style.opacity = '0.25';
    } else {
      const ratio = meleeDurabilityRatio(secondary);
      this.secondaryStat.textContent = `${Math.round(ratio * 100)}%`;
      this.secondaryStat.style.color = ratio <= 0 ? '#484f58' : '#f0f6fc';
      this.secondaryBar.style.width = `${(ratio * 100).toFixed(1)}%`;
      this.secondaryBar.style.opacity = ratio <= 0 ? '0.25' : '1';
    }
  }

  destroy(): void {
    this.onQuickUnequip = null;
    this.root.remove();
  }
}
