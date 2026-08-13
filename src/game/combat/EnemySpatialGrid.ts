import type { Enemy } from './Enemy';

/** Hash espacial para consultas de proximidade sem varrer todos os inimigos. */
export class EnemySpatialGrid {
  private readonly cells = new Map<number, Enemy[]>();

  constructor(private readonly cellSize = 128) {}

  rebuild(enemies: readonly Enemy[]): void {
    this.cells.clear();
    for (const e of enemies) {
      if (!e.alive) continue;
      this.insert(e);
    }
  }

  forEachInRadius(
    x: number,
    y: number,
    radius: number,
    fn: (enemy: Enemy) => void,
  ): void {
    const cs = this.cellSize;
    const r2 = radius * radius;
    const minCx = Math.floor((x - radius) / cs);
    const maxCx = Math.floor((x + radius) / cs);
    const minCy = Math.floor((y - radius) / cs);
    const maxCy = Math.floor((y + radius) / cs);
    for (let cy = minCy; cy <= maxCy; cy += 1) {
      for (let cx = minCx; cx <= maxCx; cx += 1) {
        const bucket = this.cells.get(this.key(cx, cy));
        if (!bucket) continue;
        for (const e of bucket) {
          const dx = e.x - x;
          const dy = e.y - y;
          if (dx * dx + dy * dy <= r2) fn(e);
        }
      }
    }
  }

  findNearest(
    x: number,
    y: number,
    radius: number,
    pred: (enemy: Enemy) => boolean,
  ): { enemy: Enemy; dist: number } | null {
    let best: Enemy | null = null;
    let bestD = Infinity;
    this.forEachInRadius(x, y, radius, (e) => {
      if (!pred(e)) return;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    });
    return best ? { enemy: best, dist: bestD } : null;
  }

  private insert(e: Enemy): void {
    const cx = Math.floor(e.x / this.cellSize);
    const cy = Math.floor(e.y / this.cellSize);
    const k = this.key(cx, cy);
    let bucket = this.cells.get(k);
    if (!bucket) {
      bucket = [];
      this.cells.set(k, bucket);
    }
    bucket.push(e);
  }

  private key(cx: number, cy: number): number {
    return cx * 65599 + cy;
  }
}
