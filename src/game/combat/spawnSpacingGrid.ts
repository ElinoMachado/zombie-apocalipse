/** Grid espacial O(1) para validar espaçamento mínimo entre spawns. */
export class SpawnSpacingGrid {
  private readonly buckets = new Map<number, { x: number; y: number }[]>();

  constructor(private readonly cellSize: number) {}

  tooClose(x: number, y: number, minSep: number): boolean {
    const cs = this.cellSize;
    const min2 = minSep * minSep;
    const cx = Math.floor(x / cs);
    const cy = Math.floor(y / cs);
    const span = Math.max(1, Math.ceil(minSep / cs));
    for (let dy = -span; dy <= span; dy += 1) {
      for (let dx = -span; dx <= span; dx += 1) {
        const bucket = this.buckets.get(this.key(cx + dx, cy + dy));
        if (!bucket) continue;
        for (const s of bucket) {
          const sdx = s.x - x;
          const sdy = s.y - y;
          if (sdx * sdx + sdy * sdy < min2) return true;
        }
      }
    }
    return false;
  }

  add(x: number, y: number): void {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    const k = this.key(cx, cy);
    let bucket = this.buckets.get(k);
    if (!bucket) {
      bucket = [];
      this.buckets.set(k, bucket);
    }
    bucket.push({ x, y });
  }

  private key(cx: number, cy: number): number {
    return cx * 65599 + cy;
  }
}
