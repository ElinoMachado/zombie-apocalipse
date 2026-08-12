/**
 * Pontos de fogo no mapa que queimam o jogador ao contacto.
 */
export class FireHazards {
  private points: { x: number; y: number; radius: number }[] = [];

  setFromCity(
    props: { kind: string; x: number; y: number }[],
    tileSize: number,
  ): void {
    this.points = [];
    for (const p of props) {
      if (p.kind !== 'burning_debris') continue;
      this.points.push({
        x: p.x * tileSize + tileSize / 2,
        y: p.y * tileSize + tileSize / 2,
        radius: tileSize * 0.55,
      });
    }
  }

  /** true se o corpo toca algum fogo. */
  touches(x: number, y: number, radius: number): boolean {
    for (const f of this.points) {
      if (Math.hypot(f.x - x, f.y - y) <= f.radius + radius) return true;
    }
    return false;
  }

  clear(): void {
    this.points = [];
  }
}
