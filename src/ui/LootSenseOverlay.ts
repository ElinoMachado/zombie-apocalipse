import type Phaser from 'phaser';
import type { LootSite } from '../game/resources/ResourceManager';

/** Setas na borda do ecrã para loot revelado fora da visão. */
export class LootSenseOverlay {
  private root: HTMLDivElement;
  private arrows = new Map<string, HTMLDivElement>();

  constructor() {
    const host = document.getElementById('ui-root');
    if (!host) throw new Error('#ui-root não encontrado');
    this.root = document.createElement('div');
    this.root.style.cssText = [
      'position:absolute',
      'inset:0',
      'pointer-events:none',
      'overflow:hidden',
      'z-index:4',
    ].join(';');
    host.append(this.root);
  }

  sync(
    sites: readonly LootSite[],
    playerX: number,
    playerY: number,
    camera: Phaser.Cameras.Scene2D.Camera,
    tileSize: number,
  ): void {
    const seen = new Set<string>();
    const pad = 28;
    const w = camera.width;
    const h = camera.height;

    for (const s of sites) {
      seen.add(s.id);
      const wv = camera.worldView;
      const sx =
        wv.width > 0 ? ((s.x - wv.x) / wv.width) * w : w / 2;
      const sy =
        wv.height > 0 ? ((s.y - wv.y) / wv.height) * h : h / 2;
      const onScreen =
        sx >= pad && sx <= w - pad && sy >= pad && sy <= h - pad;

      if (onScreen) {
        this.arrows.get(s.id)?.remove();
        this.arrows.delete(s.id);
        continue;
      }

      const cx = w / 2;
      const cy = h / 2;
      const dx = sx - cx;
      const dy = sy - cy;
      const distPx = Math.hypot(s.x - playerX, s.y - playerY);
      const distM = Math.max(1, Math.round(distPx / Math.max(1, tileSize)));

      const absDx = Math.abs(dx) || 0.001;
      const absDy = Math.abs(dy) || 0.001;
      const sxCl = (w - pad * 2) / 2 / absDx;
      const syCl = (h - pad * 2) / 2 / absDy;
      const scale = Math.min(sxCl, syCl, 1);
      const tx = cx + dx * scale;
      const ty = cy + dy * scale;

      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      let el = this.arrows.get(s.id);
      if (!el) {
        el = document.createElement('div');
        el.style.cssText = [
          'position:absolute',
          'display:flex',
          'flex-direction:column',
          'align-items:center',
          'gap:2px',
          'transform:translate(-50%,-50%)',
          'font:11px Segoe UI,system-ui,sans-serif',
          'font-weight:700',
          'color:#58a6ff',
          'text-shadow:0 1px 3px #0d1117',
          'pointer-events:none',
        ].join(';');
        const arrow = document.createElement('div');
        arrow.className = 'loot-sense-arrow';
        arrow.textContent = '➤';
        arrow.style.cssText = 'font-size:18px;line-height:1;';
        const label = document.createElement('span');
        label.className = 'loot-sense-dist';
        el.append(arrow, label);
        this.root.append(el);
        this.arrows.set(s.id, el);
      }
      el.style.left = `${tx}px`;
      el.style.top = `${ty}px`;
      const arrowEl = el.querySelector('.loot-sense-arrow') as HTMLDivElement;
      const labelEl = el.querySelector('.loot-sense-dist') as HTMLSpanElement;
      arrowEl.style.transform = `rotate(${angle}deg)`;
      labelEl.textContent = `${distM} m`;
    }

    for (const [id, el] of this.arrows) {
      if (!seen.has(id)) {
        el.remove();
        this.arrows.delete(id);
      }
    }
  }

  clear(): void {
    for (const el of this.arrows.values()) el.remove();
    this.arrows.clear();
  }

  destroy(): void {
    this.clear();
    this.root.remove();
  }
}
