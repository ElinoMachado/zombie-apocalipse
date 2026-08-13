import type { WorldCollision } from '../WorldCollision';

/** Resolução da grelha de navegação (px). */
export const ENEMY_NAV_CELL = 20;

/** Raio usado ao marcar células bloqueadas e ao planear rotas. */
export const ENEMY_NAV_RADIUS = 12;

const NEIGHBORS = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, 1.414],
  [1, -1, 1.414],
  [-1, 1, 1.414],
  [-1, -1, 1.414],
] as const;

const MAX_ASTAR_NODES = 3500;

export interface NavPoint {
  x: number;
  y: number;
}

/**
 * Grelha de walkability + A* para inimigos contornarem estruturas sólidas.
 */
export class EnemyNavGrid {
  readonly cellSize: number;
  readonly cols: number;
  readonly rows: number;
  readonly worldW: number;
  readonly worldH: number;
  private readonly blocked: Uint8Array;

  private constructor(
    worldW: number,
    worldH: number,
    cellSize: number,
    blocked: Uint8Array,
  ) {
    this.worldW = worldW;
    this.worldH = worldH;
    this.cellSize = cellSize;
    this.cols = Math.max(1, Math.ceil(worldW / cellSize));
    this.rows = Math.max(1, Math.ceil(worldH / cellSize));
    this.blocked = blocked;
  }

  static build(
    collision: WorldCollision,
    worldW: number,
    worldH: number,
    cellSize = ENEMY_NAV_CELL,
    agentRadius = ENEMY_NAV_RADIUS,
  ): EnemyNavGrid {
    const cols = Math.max(1, Math.ceil(worldW / cellSize));
    const rows = Math.max(1, Math.ceil(worldH / cellSize));
    const blocked = new Uint8Array(cols * rows);

    for (let cy = 0; cy < rows; cy += 1) {
      for (let cx = 0; cx < cols; cx += 1) {
        const baseX = cx * cellSize;
        const baseY = cy * cellSize;
        const samples = [
          [0.5, 0.5],
          [0.2, 0.5],
          [0.8, 0.5],
          [0.5, 0.2],
          [0.5, 0.8],
        ] as const;
        let isBlocked = false;
        for (const [fx, fy] of samples) {
          const x = baseX + cellSize * fx;
          const y = baseY + cellSize * fy;
          if (collision.hits({ x, y, radius: agentRadius })) {
            isBlocked = true;
            break;
          }
        }
        if (isBlocked) {
          blocked[cy * cols + cx] = 1;
        }
      }
    }

    return new EnemyNavGrid(worldW, worldH, cellSize, blocked);
  }

  isBlockedCell(cx: number, cy: number): boolean {
    if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) return true;
    return this.blocked[cy * this.cols + cx] === 1;
  }

  worldToCell(x: number, y: number): { cx: number; cy: number } {
    return {
      cx: Math.max(0, Math.min(this.cols - 1, Math.floor(x / this.cellSize))),
      cy: Math.max(0, Math.min(this.rows - 1, Math.floor(y / this.cellSize))),
    };
  }

  cellCenter(cx: number, cy: number): NavPoint {
    return {
      x: cx * this.cellSize + this.cellSize * 0.5,
      y: cy * this.cellSize + this.cellSize * 0.5,
    };
  }

  /** Caminho em coordenadas mundo; null se inacessível. */
  findPath(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
  ): NavPoint[] | null {
    const start = this.worldToCell(fromX, fromY);
    const goal = this.resolveGoalCell(toX, toY);
    if (!goal) return null;

    const goalCenter = this.cellCenter(goal.cx, goal.cy);
    const startIdx = start.cy * this.cols + start.cx;
    const goalIdx = goal.cy * this.cols + goal.cx;
    if (startIdx === goalIdx) return [goalCenter];

    const total = this.cols * this.rows;
    const gScore = new Float32Array(total);
    gScore.fill(Number.POSITIVE_INFINITY);
    const fScore = new Float32Array(total);
    fScore.fill(Number.POSITIVE_INFINITY);
    const cameFrom = new Int32Array(total);
    cameFrom.fill(-1);
    const closed = new Uint8Array(total);

    const open: number[] = [];
    const pushOpen = (idx: number, f: number): void => {
      open.push(idx);
      fScore[idx] = f;
    };

    gScore[startIdx] = 0;
    pushOpen(startIdx, this.heuristic(start.cx, start.cy, goal.cx, goal.cy));

    let expanded = 0;
    while (open.length > 0 && expanded < MAX_ASTAR_NODES) {
      expanded += 1;
      let bestPos = 0;
      let bestIdx = open[0]!;
      let bestF = fScore[bestIdx]!;
      for (let i = 1; i < open.length; i += 1) {
        const idx = open[i]!;
        const f = fScore[idx]!;
        if (f < bestF) {
          bestF = f;
          bestIdx = idx;
          bestPos = i;
        }
      }
      open.splice(bestPos, 1);

      if (bestIdx === goalIdx) {
        return this.reconstructPath(
          cameFrom,
          goalIdx,
          startIdx,
          goalCenter.x,
          goalCenter.y,
        );
      }
      if (closed[bestIdx]) continue;
      closed[bestIdx] = 1;

      const cx = bestIdx % this.cols;
      const cy = Math.floor(bestIdx / this.cols);
      const baseG = gScore[bestIdx]!;

      for (const [dx, dy, cost] of NEIGHBORS) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (this.isBlockedCell(nx, ny)) continue;
        if (dx !== 0 && dy !== 0) {
          if (this.isBlockedCell(cx + dx, cy) || this.isBlockedCell(cx, cy + dy)) {
            continue;
          }
        }
        const nIdx = ny * this.cols + nx;
        if (closed[nIdx]) continue;

        const tentative = baseG + cost;
        if (tentative >= gScore[nIdx]!) continue;

        cameFrom[nIdx] = bestIdx;
        gScore[nIdx] = tentative;
        pushOpen(nIdx, tentative + this.heuristic(nx, ny, goal.cx, goal.cy));
      }
    }

    return null;
  }

  /**
   * Célula walkable mais próxima do alvo (mundo).
   * Importante: mede distância ao jogador, não ao inimigo — evita meta
   * do lado errado de um carro/parede quando o alvo está encostado ao obstáculo.
   */
  private resolveGoalCell(
    toX: number,
    toY: number,
  ): { cx: number; cy: number } | null {
    const raw = this.worldToCell(toX, toY);
    if (!this.isBlockedCell(raw.cx, raw.cy)) return raw;

    const maxRing = 18;
    let goalCx = 0;
    let goalCy = 0;
    let bestDist = Number.POSITIVE_INFINITY;
    let found = false;

    for (let ring = 1; ring <= maxRing; ring += 1) {
      for (let dy = -ring; dy <= ring; dy += 1) {
        for (let dx = -ring; dx <= ring; dx += 1) {
          if (Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
          const cx = raw.cx + dx;
          const cy = raw.cy + dy;
          if (this.isBlockedCell(cx, cy)) continue;
          const center = this.cellCenter(cx, cy);
          const d = Math.hypot(center.x - toX, center.y - toY);
          if (!found || d < bestDist) {
            found = true;
            bestDist = d;
            goalCx = cx;
            goalCy = cy;
          }
        }
      }
      if (found && bestDist <= this.cellSize * 1.25) break;
    }

    if (!found) return null;
    return { cx: goalCx, cy: goalCy };
  }

  private heuristic(ax: number, ay: number, bx: number, by: number): number {
    return Math.hypot(ax - bx, ay - by);
  }

  private reconstructPath(
    cameFrom: Int32Array,
    goalIdx: number,
    startIdx: number,
    targetX: number,
    targetY: number,
  ): NavPoint[] {
    const cells: number[] = [];
    let cur = goalIdx;
    while (cur !== -1 && cur !== startIdx) {
      cells.push(cur);
      cur = cameFrom[cur]!;
    }
    cells.reverse();

    const points: NavPoint[] = [];
    for (const idx of cells) {
      const cx = idx % this.cols;
      const cy = Math.floor(idx / this.cols);
      points.push(this.cellCenter(cx, cy));
    }
    points.push({ x: targetX, y: targetY });
    return this.simplifyPath(points);
  }

  /** Remove waypoints colineares com linha de visão livre (aprox. células). */
  private simplifyPath(points: NavPoint[]): NavPoint[] {
    if (points.length <= 2) return points;
    const out: NavPoint[] = [points[0]!];
    let anchor = 0;
    for (let i = 2; i < points.length; i += 1) {
      const a = points[anchor]!;
      const b = points[i]!;
      if (!this.lineCellsClear(a.x, a.y, b.x, b.y)) {
        out.push(points[i - 1]!);
        anchor = i - 1;
      }
    }
    out.push(points[points.length - 1]!);
    return out;
  }

  private lineCellsClear(x0: number, y0: number, x1: number, y1: number): boolean {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(2, Math.ceil(dist / (this.cellSize * 0.5)));
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      const { cx, cy } = this.worldToCell(x, y);
      if (this.isBlockedCell(cx, cy)) return false;
    }
    return true;
  }
}
