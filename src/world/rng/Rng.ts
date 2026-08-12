/** PRNG mulberry32 — determinístico. Nunca usar Math.random no world/. */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(min: number, max: number): number {
    if (max < min) return min;
    return min + Math.floor(this.next() * (max - min + 1));
  }

  float(min = 0, max = 1): number {
    return min + this.next() * (max - min);
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick: empty array');
    return items[this.int(0, items.length - 1)]!;
  }

  weightedPick<T extends string>(weights: Partial<Record<T, number>>): T | null {
    const entries = Object.entries(weights).filter(
      ([, w]) => typeof w === 'number' && w > 0,
    ) as [T, number][];
    if (entries.length === 0) return null;
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let r = this.next() * total;
    for (const [id, w] of entries) {
      r -= w;
      if (r <= 0) return id;
    }
    return entries[entries.length - 1]![0];
  }

  /** Escolhe entre top-K itens por peso (score). */
  pickWeightedItems<T>(items: T[], weightFn: (item: T) => number): T | null {
    if (items.length === 0) return null;
    const weights = items.map(weightFn);
    const total = weights.reduce((s, w) => s + Math.max(0, w), 0);
    if (total <= 0) return this.pick(items);
    let r = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      r -= Math.max(0, weights[i]!);
      if (r <= 0) return items[i]!;
    }
    return items[items.length - 1]!;
  }

  shuffle<T>(items: T[]): T[] {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [arr[i], arr[j]] = [arr[j]!, arr[i]!];
    }
    return arr;
  }

  fork(label: string): Rng {
    return new Rng(deriveSeed(this.state, label));
  }
}

/** Deriva seed determinística a partir de pai + label. */
export function deriveSeed(parent: number, label: string): number {
  let h = parent >>> 0;
  for (let i = 0; i < label.length; i++) {
    h = Math.imul(h ^ label.charCodeAt(i), 0x01000193);
  }
  return h >>> 0;
}
