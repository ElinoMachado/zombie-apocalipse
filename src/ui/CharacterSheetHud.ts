import type { Inventory } from '../game/inventory/inventory';
import {
  ITEMS,
  INVENTORY_SLOTS,
  MAX_CARRY_WEIGHT,
  itemTooltipText,
} from '../game/inventory/inventory';
import type {
  EquipmentLoadout,
  EquipSlotId,
} from '../game/inventory/equipmentLoadout';
import type { SurvivalState } from '../game/survival/SurvivalState';
import {
  ATTRIBUTE_IDS,
  ATTRIBUTE_LABELS,
  formatModifier,
  type AttributeId,
} from '../game/progression/attributes';
import { talentEffectsFor } from '../game/progression/talentEffects';
import type { PlayerProgression } from '../game/progression/PlayerProgression';
import {
  TALENT_CATEGORIES,
  TALENT_CATEGORY_LABELS,
  talentTooltipHtml,
  talentsInCategory,
  type TalentDef,
  type TalentId,
} from '../game/progression/talents';

type SheetCloseHandler = () => void;
type AttributeSpendHandler = (id: AttributeId) => boolean;
type TalentSpendHandler = (id: TalentId) => boolean;
type InventoryUseHandler = (slotIndex: number) => boolean;
type UnequipHandler = (slot: EquipSlotId) => boolean;

/** Ficha completa (I): equipamento, dados pessoais, atributos, inventário. */
export class CharacterSheetHud {
  private overlay: HTMLDivElement;
  private panel: HTMLDivElement;
  private levelUpBanner: HTMLDivElement;
  private attrGrid: HTMLDivElement;
  private invGrid!: HTMLDivElement;
  private weightLabel!: HTMLSpanElement;
  private talentAddBtn!: HTMLButtonElement;
  private talentPointsLabel!: HTMLSpanElement;
  private talentList!: HTMLDivElement;
  private talentPicker!: HTMLDivElement;
  private talentTooltip!: HTMLDivElement;
  private onClose: SheetCloseHandler | null = null;
  private onSpendAttr: AttributeSpendHandler | null = null;
  private onSpendTalent: TalentSpendHandler | null = null;
  private onUseItem: InventoryUseHandler | null = null;
  private onUnequip: UnequipHandler | null = null;
  private survivalRow!: HTMLDivElement;
  private pickerOpen = false;
  private open = false;
  private lastProgression: PlayerProgression | null = null;

  constructor() {
    const host = document.getElementById('ui-root');
    if (!host) throw new Error('#ui-root não encontrado');

    this.overlay = document.createElement('div');
    this.overlay.style.cssText = [
      'position:absolute',
      'inset:0',
      'display:none',
      'align-items:center',
      'justify-content:center',
      'background:rgba(1,4,9,0.72)',
      'z-index:40',
      'pointer-events:auto',
      'font:12px Segoe UI,system-ui,sans-serif',
      'color:#e6edf3',
    ].join(';');
    this.overlay.addEventListener('click', (ev) => {
      if (ev.target === this.overlay) this.closeSheet();
    });

    this.panel = document.createElement('div');
    this.panel.style.cssText = [
      'display:flex',
      'flex-direction:column',
      'gap:12px',
      'width:min(820px,94vw)',
      'max-height:90vh',
      'overflow:auto',
      'padding:16px 18px',
      'background:rgba(13,17,23,0.97)',
      'border:1px solid #30363d',
      'border-radius:12px',
      'box-shadow:0 16px 48px rgba(0,0,0,0.55)',
    ].join(';');
    this.panel.addEventListener('click', (ev) => ev.stopPropagation());

    const header = document.createElement('div');
    header.style.cssText =
      'display:flex;justify-content:space-between;align-items:flex-start;gap:12px;';
    const title = document.createElement('div');
    title.style.cssText = 'font-size:16px;font-weight:800;color:#e6edf3;';
    title.textContent = 'Personagem';
    const hint = document.createElement('div');
    hint.style.cssText = 'font-size:11px;color:#8b949e;margin-top:2px;';
    hint.textContent =
      'I ou Esc — fechar · clique item = usar/equipar · clique slot = desequipar';
    title.append(hint);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = [
      'border:none',
      'background:#21262d',
      'color:#e6edf3',
      'width:28px',
      'height:28px',
      'border-radius:6px',
      'cursor:pointer',
      'font-size:14px',
    ].join(';');
    closeBtn.addEventListener('click', () => this.closeSheet());
    header.append(title, closeBtn);

    this.levelUpBanner = document.createElement('div');
    this.levelUpBanner.style.cssText = [
      'display:none',
      'padding:8px 12px',
      'border-radius:8px',
      'background:rgba(35,134,54,0.2)',
      'border:1px solid #238636',
      'color:#7ee787',
      'font-size:12px',
      'font-weight:600',
    ].join(';');

    const body = document.createElement('div');
    body.style.cssText =
      'display:grid;grid-template-columns:1fr 1fr;gap:14px;';
    if (typeof matchMedia !== 'undefined' && matchMedia('(max-width:640px)').matches) {
      body.style.gridTemplateColumns = '1fr';
    }

    const leftCol = document.createElement('div');
    leftCol.style.cssText = 'display:flex;flex-direction:column;gap:10px;';
    leftCol.append(
      this.makeSection('Silhueta & equipamento', this.buildEquipBlock()),
      this.makeSection('Dados pessoais', this.buildProfileBlock()),
      this.makeSection('Sobrevivência', this.buildSurvivalBlock()),
    );

    const rightCol = document.createElement('div');
    rightCol.style.cssText = 'display:flex;flex-direction:column;gap:10px;';
    this.attrGrid = document.createElement('div');
    this.attrGrid.style.cssText =
      'display:grid;grid-template-columns:1fr 1fr;gap:6px;';
    rightCol.append(
      this.makeSection('Atributos', this.attrGrid),
      this.makeSection('Inventário', this.buildInventoryBlock()),
    );

    body.append(leftCol, rightCol);

    const talentsBlock = this.buildTalentsSection();
    this.panel.append(header, this.levelUpBanner, body, talentsBlock);
    this.overlay.append(this.panel);
    host.append(this.overlay);

    document.addEventListener('keydown', this.onKeyDown);
  }

  private onKeyDown = (ev: KeyboardEvent): void => {
    if (!this.open) return;
    if (ev.key === 'Escape' || ev.key === 'i' || ev.key === 'I') {
      ev.preventDefault();
      this.closeSheet();
    }
  };

  setHandlers(
    onClose: SheetCloseHandler | null,
    onSpendAttr: AttributeSpendHandler | null,
    onSpendTalent: TalentSpendHandler | null = null,
    onUseItem: InventoryUseHandler | null = null,
    onUnequip: UnequipHandler | null = null,
  ): void {
    this.onClose = onClose;
    this.onSpendAttr = onSpendAttr;
    this.onSpendTalent = onSpendTalent;
    this.onUseItem = onUseItem;
    this.onUnequip = onUnequip;
  }

  toggle(): boolean {
    if (this.open) {
      this.closeSheet();
      return false;
    }
    this.openSheet();
    return true;
  }

  isOpen(): boolean {
    return this.open;
  }

  openSheet(): void {
    this.open = true;
    this.overlay.style.display = 'flex';
  }

  closeSheet(): void {
    if (!this.open) return;
    this.open = false;
    this.pickerOpen = false;
    this.overlay.style.display = 'none';
    this.levelUpBanner.style.display = 'none';
    this.talentPicker.style.display = 'none';
    this.hideTalentTooltip();
    this.onClose?.();
  }

  showLevelUpMessage(text: string): void {
    this.levelUpBanner.textContent = text;
    this.levelUpBanner.style.display = 'block';
  }

  sync(
    progression: PlayerProgression,
    inv: Inventory,
    loadout: EquipmentLoadout,
    survival: SurvivalState,
    armorBonus = 0,
  ): void {
    this.lastProgression = progression;
    this.renderAttributes(progression, armorBonus);
    this.renderProfile(progression);
    this.renderSurvival(survival);
    this.renderInventory(inv);
    this.renderEquipLabels(loadout);
    this.renderTalents(progression);
    if (this.pickerOpen) this.renderTalentPicker(progression);
  }

  private makeSection(label: string, content: HTMLElement): HTMLDivElement {
    const wrap = document.createElement('div');
    wrap.style.cssText = [
      'padding:10px',
      'border-radius:8px',
      'background:#161b22',
      'border:1px solid #30363d',
    ].join(';');
    const head = document.createElement('div');
    head.style.cssText =
      'font-size:11px;font-weight:700;color:#8b949e;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;';
    head.textContent = label;
    wrap.append(head, content);
    return wrap;
  }

  private profileFields: Record<string, HTMLSpanElement> = {};

  private buildProfileBlock(): HTMLDivElement {
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:auto 1fr;gap:4px 10px;font-size:12px;';
    const labels = [
      'Nome',
      'Idade',
      'Sexo',
      'Profissão',
      'Religião',
      'Tendência',
    ];
    for (const lab of labels) {
      const k = document.createElement('span');
      k.textContent = `${lab}:`;
      k.style.color = '#8b949e';
      const v = document.createElement('span');
      v.style.fontWeight = '600';
      this.profileFields[lab] = v;
      grid.append(k, v);
    }
    return grid;
  }

  private equipSlots: Record<string, HTMLDivElement> = {};

  private buildEquipBlock(): HTMLDivElement {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;gap:12px;align-items:flex-start;';

    const figure = document.createElement('div');
    figure.style.cssText = [
      'width:72px',
      'height:120px',
      'border-radius:10px',
      'background:linear-gradient(180deg,#21262d,#161b22)',
      'border:1px dashed #484f58',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'color:#484f58',
      'font-size:10px',
      'text-align:center',
      'flex-shrink:0',
    ].join(';');
    figure.textContent = 'Personagem\n(em breve)';

    const slots = document.createElement('div');
    slots.style.cssText =
      'display:grid;grid-template-columns:1fr 1fr;gap:6px;flex:1;';

    const defs: [string, string][] = [
      ['head', 'Cabeça'],
      ['chest', 'Peito'],
      ['arms', 'Braços'],
      ['legs', 'Pernas'],
      ['feet', 'Pés'],
      ['primary', 'Arma primária'],
      ['secondary', 'Arma secundária'],
    ];
    for (const [id, label] of defs) {
      const slot = document.createElement('div');
      slot.style.cssText = [
        'padding:6px 8px',
        'border-radius:6px',
        'background:#0d1117',
        'border:1px solid #30363d',
        'font-size:10px',
        'color:#8b949e',
      ].join(';');
      slot.dataset.slot = id;
      slot.textContent = label;
      slot.style.cursor = 'pointer';
      slot.title = `${label} — clique ou botão direito para desequipar`;
      slot.addEventListener('click', () => {
        this.onUnequip?.(id as EquipSlotId);
      });
      slot.addEventListener('contextmenu', (ev) => {
        ev.preventDefault();
        this.onUnequip?.(id as EquipSlotId);
      });
      this.equipSlots[id] = slot;
      slots.append(slot);
    }

    wrap.append(figure, slots);
    return wrap;
  }

  private renderEquipLabels(loadout: EquipmentLoadout): void {
    const labels: Record<string, string> = {
      head: 'Cabeça',
      chest: 'Peito',
      arms: 'Braços',
      legs: 'Pernas',
      feet: 'Pés',
      primary: 'Arma primária',
      secondary: 'Arma secundária',
    };
    for (const [id, prefix] of Object.entries(labels)) {
      const el = this.equipSlots[id];
      if (!el) continue;
      const name = loadout.labelForSlot(id as EquipSlotId);
      el.textContent = `${prefix} · ${name}`;
    }
  }

  private buildSurvivalBlock(): HTMLDivElement {
    this.survivalRow = document.createElement('div');
    this.survivalRow.style.cssText =
      'font-size:11px;line-height:1.5;color:#c9d1d9;display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;';
    return this.survivalRow;
  }

  private renderSurvival(s: SurvivalState): void {
    const flags: string[] = [];
    if (s.bleeding) flags.push('Sangramento');
    if (s.infection !== 'none') flags.push(`Infecção (${s.infection})`);
    if (s.minorWounds) flags.push('Ferimentos leves');
    if (s.majorWounds) flags.push('Ferimentos graves');
    if (s.hasAdrenaline()) flags.push('Adrenalina');
    if (s.speedMultiplier() > 1) flags.push('Buff velocidade');
    this.survivalRow.innerHTML = [
      `<span>Fome <strong>${Math.round(s.hunger)}</strong></span>`,
      `<span>Hidratação <strong>${Math.round(s.hydration)}</strong></span>`,
      `<span>Fadiga <strong>${Math.round(s.fatigue)}</strong></span>`,
      `<span>${flags.length ? flags.join(' · ') : 'Sem condições críticas'}</span>`,
    ].join('');
  }

  private renderProfile(progression: PlayerProgression): void {
    const p = progression.profile;
    this.profileFields.Nome!.textContent = p.name;
    this.profileFields.Idade!.textContent = String(p.age);
    this.profileFields.Sexo!.textContent = p.sex;
    this.profileFields.Profissão!.textContent = p.profession;
    this.profileFields.Religião!.textContent = p.religion;
    this.profileFields.Tendência!.textContent = p.tendency;
  }

  private renderAttributes(progression: PlayerProgression, armorBonus = 0): void {
    this.attrGrid.replaceChildren();
    const fx = talentEffectsFor(progression);
    const ac = fx.playerAcTotal(progression.attributes.reflexes, armorBonus);
    const points = progression.attributePoints;
    const ptsNote = document.createElement('div');
    ptsNote.style.cssText =
      'grid-column:1/-1;font-size:11px;color:#ffe082;margin-bottom:4px;';
    ptsNote.textContent =
      points > 0
        ? `${points} ponto(s) de atributo · ${progression.talentPoints} talento(s)`
        : `${progression.talentPoints} ponto(s) de talento (níveis pares)`;
    this.attrGrid.append(ptsNote);

    for (const id of ATTRIBUTE_IDS) {
      const score = progression.attributes[id];
      const mod = progression.getMod(id);
      const row = document.createElement('div');
      row.style.cssText = [
        'display:flex',
        'align-items:center',
        'justify-content:space-between',
        'gap:6px',
        'padding:5px 8px',
        'border-radius:6px',
        'background:#0d1117',
        'border:1px solid #30363d',
      ].join(';');

      const label = document.createElement('span');
      label.style.fontSize = '11px';
      label.textContent = ATTRIBUTE_LABELS[id];

      const val = document.createElement('span');
      val.style.cssText =
        'font-variant-numeric:tabular-nums;font-weight:700;font-size:12px;';
      val.textContent = `${score} (${formatModifier(mod)})`;

      row.append(label, val);

      if (points > 0) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = '+';
        btn.title = `+1 ${ATTRIBUTE_LABELS[id]}`;
        btn.style.cssText = [
          'margin-left:4px',
          'width:22px',
          'height:22px',
          'border:none',
          'border-radius:4px',
          'background:#238636',
          'color:#fff',
          'cursor:pointer',
          'font-weight:800',
          'line-height:1',
        ].join(';');
        btn.addEventListener('click', () => {
          this.onSpendAttr?.(id);
        });
        row.append(btn);
      }

      this.attrGrid.append(row);
    }

    const acRow = document.createElement('div');
    acRow.style.cssText = [
      'grid-column:1/-1',
      'display:flex',
      'justify-content:space-between',
      'padding:6px 8px',
      'border-radius:6px',
      'background:rgba(88,166,255,0.12)',
      'border:1px solid #388bfd',
      'font-weight:700',
    ].join(';');
    acRow.innerHTML = `<span>Classe de armadura</span><span>${ac}${armorBonus > 0 ? ` (+${armorBonus} equip.)` : ''}</span>`;
    this.attrGrid.append(acRow);
  }

  private buildInventoryBlock(): HTMLDivElement {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;';

    this.weightLabel = document.createElement('span');
    this.weightLabel.style.cssText =
      'font-size:11px;color:#8b949e;font-variant-numeric:tabular-nums;';
    this.weightLabel.textContent = `Peso 0/${MAX_CARRY_WEIGHT}`;

    this.invGrid = document.createElement('div');
    this.invGrid.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;';

    wrap.append(this.weightLabel, this.invGrid);
    return wrap;
  }

  private renderInventory(inv: Inventory): void {
    const w = inv.totalWeight;
    this.weightLabel.textContent = `Peso ${w}/${inv.maxWeight}`;
    this.weightLabel.style.color =
      w >= inv.maxWeight ? '#ff8a80' : w >= inv.maxWeight * 0.75 ? '#ffe082' : '#8b949e';

    this.invGrid.replaceChildren();
    for (let i = 0; i < INVENTORY_SLOTS; i += 1) {
      const slot = inv.slots[i] ?? null;
      const box = document.createElement('div');
      box.style.cssText = [
        'width:52px',
        'height:52px',
        'border-radius:8px',
        'background:#0d1117',
        'border:1px solid #30363d',
        'display:flex',
        'flex-direction:column',
        'align-items:center',
        'justify-content:center',
        'gap:2px',
        'font-size:9px',
        'position:relative',
      ].join(';');

      if (!slot) {
        box.style.opacity = '0.45';
        this.invGrid.append(box);
        continue;
      }

      const def = ITEMS[slot.itemId];
      const hex = `#${def.color.toString(16).padStart(6, '0')}`;
      box.style.borderColor = hex;
      box.title = `${itemTooltipText(def, slot.qty)}\nClique: usar ou equipar`;
      box.style.cursor = 'pointer';

      box.addEventListener('click', () => {
        this.onUseItem?.(i);
      });

      const sw = document.createElement('div');
      sw.style.cssText = `width:16px;height:16px;border-radius:4px;background:${hex};`;
      const name = document.createElement('span');
      name.textContent = def.label;
      name.style.cssText =
        'max-width:48px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#c9d1d9;';
      box.append(sw, name);

      if (slot.qty > 1) {
        const q = document.createElement('span');
        q.textContent = String(slot.qty);
        q.style.cssText =
          'position:absolute;right:3px;bottom:2px;font-weight:800;font-size:10px;';
        box.append(q);
      }

      this.invGrid.append(box);
    }
  }

  destroy(): void {
    document.removeEventListener('keydown', this.onKeyDown);
    this.onClose = null;
    this.onSpendAttr = null;
    this.onSpendTalent = null;
    this.onUseItem = null;
    this.onUnequip = null;
    this.talentTooltip.remove();
    this.overlay.remove();
  }

  private buildTalentsSection(): HTMLDivElement {
    const wrap = this.makeSection('Habilidades', document.createElement('div'));
    const inner = wrap.lastElementChild as HTMLDivElement;

    const headRow = document.createElement('div');
    headRow.style.cssText =
      'display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;';

    this.talentPointsLabel = document.createElement('span');
    this.talentPointsLabel.style.cssText =
      'font-size:11px;color:#8b949e;font-variant-numeric:tabular-nums;';

    this.talentAddBtn = document.createElement('button');
    this.talentAddBtn.type = 'button';
    this.talentAddBtn.textContent = '+ Adicionar talento';
    this.styleTalentAddBtn(false);
    this.talentAddBtn.addEventListener('click', () => {
      if (!this.lastProgression || this.lastProgression.talentPoints <= 0) return;
      this.pickerOpen = !this.pickerOpen;
      this.talentPicker.style.display = this.pickerOpen ? 'block' : 'none';
      if (this.pickerOpen && this.lastProgression) {
        this.renderTalentPicker(this.lastProgression);
      }
    });

    headRow.append(this.talentPointsLabel, this.talentAddBtn);

    this.talentPicker = document.createElement('div');
    this.talentPicker.style.cssText = [
      'display:none',
      'max-height:220px',
      'overflow:auto',
      'margin-bottom:10px',
      'padding:8px',
      'border-radius:8px',
      'background:#0d1117',
      'border:1px solid #30363d',
    ].join(';');

    this.talentList = document.createElement('div');
    this.talentList.style.cssText =
      'display:flex;flex-direction:column;gap:4px;min-height:32px;';

    this.talentTooltip = document.createElement('div');
    this.talentTooltip.style.cssText = [
      'position:fixed',
      'display:none',
      'max-width:280px',
      'padding:10px 12px',
      'background:rgba(13,17,23,0.98)',
      'border:1px solid #30363d',
      'border-radius:8px',
      'box-shadow:0 12px 32px rgba(0,0,0,0.5)',
      'pointer-events:none',
      'z-index:60',
      'text-align:left',
      'font-size:11px',
      'line-height:1.45',
    ].join(';');
    document.body.append(this.talentTooltip);

    inner.append(headRow, this.talentPicker, this.talentList);
    return wrap;
  }

  private styleTalentAddBtn(hasPoints: boolean): void {
    if (hasPoints) {
      this.talentAddBtn.style.cssText = [
        'border:none',
        'padding:6px 12px',
        'border-radius:6px',
        'background:#238636',
        'color:#fff',
        'font-weight:700',
        'font-size:11px',
        'cursor:pointer',
        'box-shadow:0 0 0 1px #2ea043',
      ].join(';');
      this.talentAddBtn.disabled = false;
    } else {
      this.talentAddBtn.style.cssText = [
        'border:1px solid #30363d',
        'padding:6px 12px',
        'border-radius:6px',
        'background:#21262d',
        'color:#8b949e',
        'font-weight:600',
        'font-size:11px',
        'cursor:not-allowed',
      ].join(';');
      this.talentAddBtn.disabled = true;
    }
  }

  private renderTalents(progression: PlayerProgression): void {
    const pts = progression.talentPoints;
    this.talentPointsLabel.textContent =
      pts > 0
        ? `${pts} ponto(s) de talento disponível(is)`
        : 'Sem pontos de talento (níveis pares)';
    this.styleTalentAddBtn(pts > 0);

    this.talentList.replaceChildren();
    const owned = progression.listOwnedTalents();
    if (owned.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'font-size:11px;color:#484f58;font-style:italic;';
      empty.textContent = 'Nenhuma habilidade seleccionada.';
      this.talentList.append(empty);
      return;
    }

    for (const { def, level } of owned) {
      const row = document.createElement('div');
      row.style.cssText = [
        'display:flex',
        'align-items:center',
        'justify-content:space-between',
        'gap:8px',
        'padding:6px 8px',
        'border-radius:6px',
        'background:#0d1117',
        'border:1px solid #30363d',
        'cursor:default',
      ].join(';');

      const left = document.createElement('div');
      left.style.cssText = 'display:flex;flex-direction:column;gap:2px;min-width:0;';
      const name = document.createElement('span');
      name.style.cssText = 'font-weight:700;font-size:12px;color:#e6edf3;';
      name.textContent = def.name;
      const sub = document.createElement('span');
      sub.style.cssText = 'font-size:10px;color:#8b949e;';
      sub.textContent = `${TALENT_CATEGORY_LABELS[def.category]} · Nv${level}`;
      left.append(name, sub);

      const badge = document.createElement('span');
      badge.style.cssText = [
        'flex-shrink:0',
        'font-size:10px',
        'font-weight:800',
        'padding:2px 6px',
        'border-radius:999px',
        'background:rgba(163,113,247,0.2)',
        'color:#a371f7',
        'font-variant-numeric:tabular-nums',
      ].join(';');
      badge.textContent = `Nv${level}`;

      row.append(left, badge);

      row.addEventListener('mouseenter', (ev) => {
        this.showTalentTooltip(def, level, ev.clientX, ev.clientY);
      });
      row.addEventListener('mousemove', (ev) => {
        this.positionTalentTooltip(ev.clientX, ev.clientY);
      });
      row.addEventListener('mouseleave', () => this.hideTalentTooltip());

      this.talentList.append(row);
    }
  }

  private renderTalentPicker(progression: PlayerProgression): void {
    this.talentPicker.replaceChildren();

    const note = document.createElement('div');
    note.style.cssText =
      'font-size:10px;color:#8b949e;margin-bottom:8px;line-height:1.4;';
    note.textContent =
      'Escolha uma habilidade para aprender (Nv1) ou subir de nível. Habilidades iguais usam sempre o maior nível.';
    this.talentPicker.append(note);

    for (const cat of TALENT_CATEGORIES) {
      const catHead = document.createElement('div');
      catHead.style.cssText =
        'font-size:10px;font-weight:800;color:#58a6ff;text-transform:uppercase;letter-spacing:0.05em;margin:10px 0 4px;';
      catHead.textContent = TALENT_CATEGORY_LABELS[cat];
      this.talentPicker.append(catHead);

      for (const def of talentsInCategory(cat)) {
        const level = progression.getTalentLevel(def.id);
        const maxed = level >= def.maxLevel;
        const canBuy = progression.canUpgradeTalent(def.id);

        const row = document.createElement('button');
        row.type = 'button';
        row.style.cssText = [
          'display:flex',
          'align-items:center',
          'justify-content:space-between',
          'gap:8px',
          'width:100%',
          'text-align:left',
          'padding:6px 8px',
          'margin-bottom:3px',
          'border-radius:6px',
          'border:1px solid #30363d',
          'background:#161b22',
          'color:#e6edf3',
          'cursor:pointer',
          'font:inherit',
        ].join(';');
        if (!canBuy) {
          row.style.opacity = maxed ? '0.55' : '0.75';
          row.style.cursor = maxed ? 'default' : 'not-allowed';
        }

        const label = document.createElement('span');
        label.style.fontSize = '11px';
        label.innerHTML = `<strong>${def.name}</strong>${level > 0 ? ` <span style="color:#a371f7">Nv${level}</span>` : ''}`;

        const action = document.createElement('span');
        action.style.cssText = 'font-size:10px;color:#8b949e;flex-shrink:0;';
        if (maxed) action.textContent = 'Máx.';
        else if (level > 0) action.textContent = 'Subir Nv';
        else action.textContent = 'Aprender';

        row.append(label, action);

        row.addEventListener('mouseenter', (ev) => {
          this.showTalentTooltip(def, level, ev.clientX, ev.clientY);
        });
        row.addEventListener('mousemove', (ev) => {
          this.positionTalentTooltip(ev.clientX, ev.clientY);
        });
        row.addEventListener('mouseleave', () => this.hideTalentTooltip());

        row.addEventListener('click', () => {
          if (!canBuy) return;
          if (this.onSpendTalent?.(def.id)) {
            if (this.lastProgression) {
              this.renderTalents(this.lastProgression);
              this.renderTalentPicker(this.lastProgression);
              if (this.lastProgression.talentPoints <= 0) {
                this.pickerOpen = false;
                this.talentPicker.style.display = 'none';
              }
            }
          }
        });

        this.talentPicker.append(row);
      }
    }
  }

  private showTalentTooltip(
    def: TalentDef,
    level: number,
    x: number,
    y: number,
  ): void {
    this.talentTooltip.innerHTML = talentTooltipHtml(def, level);
    this.talentTooltip.style.display = 'block';
    this.positionTalentTooltip(x, y);
  }

  private positionTalentTooltip(x: number, y: number): void {
    const pad = 12;
    const tw = this.talentTooltip.offsetWidth || 260;
    const th = this.talentTooltip.offsetHeight || 120;
    let left = x + pad;
    let top = y + pad;
    if (left + tw > window.innerWidth - pad) left = x - tw - pad;
    if (top + th > window.innerHeight - pad) top = y - th - pad;
    this.talentTooltip.style.left = `${Math.max(pad, left)}px`;
    this.talentTooltip.style.top = `${Math.max(pad, top)}px`;
  }

  private hideTalentTooltip(): void {
    this.talentTooltip.style.display = 'none';
  }
}

export type { AttributeId };
