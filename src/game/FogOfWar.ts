/**
 * Fog of war lógico: explored (permanente) + visible (raio actual).
 * O mapa de dados já existe; isto só controla o que pode materializar-se.
 */

export class FogOfWar {
  readonly width: number;
  readonly height: number;
  /** Já foi visto alguma vez */
  readonly explored: Uint8Array;
  /** No raio de visão neste frame (inclui penumbra) */
  readonly visible: Uint8Array;

  constructor(w: number, h: number) {
    this.width = w;
    this.height = h;
    this.explored = new Uint8Array(w * h);
    this.visible = new Uint8Array(w * h);
  }

  idx(x: number, y: number): number {
    return y * this.width + x;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  isExplored(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return false;
    return this.explored[this.idx(x, y)] === 1;
  }

  isVisible(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return false;
    return this.visible[this.idx(x, y)] === 1;
  }

  /**
   * Recalcula `visible` e marca `explored` no círculo até `outerRadiusTiles`
   * (visão nítida + penumbra).
   */
  revealCircle(cx: number, cy: number, outerRadiusTiles: number): number[] {
    this.visible.fill(0);
    const newly: number[] = [];
    const r = Math.max(0, Math.ceil(outerRadiusTiles));
    const r2 = r * r;

    const x0 = Math.max(0, cx - r);
    const x1 = Math.min(this.width - 1, cx + r);
    const y0 = Math.max(0, cy - r);
    const y1 = Math.min(this.height - 1, cy + r);

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy > r2) continue;
        const i = this.idx(x, y);
        this.visible[i] = 1;
        if (this.explored[i] === 0) {
          this.explored[i] = 1;
          newly.push(i);
        }
      }
    }
    return newly;
  }
}
