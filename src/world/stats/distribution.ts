import type { Rng } from '../rng/Rng';
import type { Distribution } from './types';

/** Constrói Distribution a partir de valores brutos (ordenados internamente). */
export function fromSamples(
  values: number[],
  opts?: { unit?: string; notes?: string; confidence?: number },
): Distribution {
  if (values.length === 0) {
    return {
      mean: 0,
      median: 0,
      stdDev: 0,
      p10: 0,
      p25: 0,
      p50: 0,
      p75: 0,
      p90: 0,
      sampleSize: 0,
      confidence: 0,
      unit: opts?.unit,
      notes: opts?.notes ?? 'INSUFFICIENT DATA: empty sample',
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  const variance =
    n < 2 ? 0 : sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);

  return {
    mean,
    median: quantile(sorted, 0.5),
    stdDev: Math.sqrt(variance),
    p10: quantile(sorted, 0.1),
    p25: quantile(sorted, 0.25),
    p50: quantile(sorted, 0.5),
    p75: quantile(sorted, 0.75),
    p90: quantile(sorted, 0.9),
    sampleSize: n,
    confidence: opts?.confidence ?? Math.min(1, n / 100),
    unit: opts?.unit,
    notes: opts?.notes,
  };
}

/** Percentil linear (sorted ascending). */
export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0]!;
  const clamped = Math.max(0, Math.min(1, q));
  const pos = (sorted.length - 1) * clamped;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo]!;
  const t = pos - lo;
  return sorted[lo]! * (1 - t) + sorted[hi]! * t;
}

/**
 * Amostra um valor da distribuição via quantil uniforme U~[0,1]
 * interpolando P10–P90 (com extrapolação suave para caudas).
 */
export function sampleDistribution(rng: Rng, d: Distribution): number {
  const u = rng.next();
  if (u < 0.1) {
    return lerp(d.p10, d.p25, u / 0.1);
  }
  if (u < 0.25) {
    return lerp(d.p10, d.p25, (u - 0.1) / 0.15);
  }
  if (u < 0.5) {
    return lerp(d.p25, d.p50, (u - 0.25) / 0.25);
  }
  if (u < 0.75) {
    return lerp(d.p50, d.p75, (u - 0.5) / 0.25);
  }
  if (u < 0.9) {
    return lerp(d.p75, d.p90, (u - 0.75) / 0.15);
  }
  return lerp(d.p75, d.p90, 1 + (u - 0.9) / 0.1);
}

/** Amostra inteira arredondada. */
export function sampleInt(rng: Rng, d: Distribution): number {
  return Math.round(sampleDistribution(rng, d));
}

export function dist(
  partial: Partial<Distribution> & Pick<Distribution, 'p50'>,
): Distribution {
  const p50 = partial.p50;
  const p25 = partial.p25 ?? p50 * 0.85;
  const p75 = partial.p75 ?? p50 * 1.15;
  const p10 = partial.p10 ?? p25 * 0.9;
  const p90 = partial.p90 ?? p75 * 1.1;
  const mean = partial.mean ?? (p25 + p50 + p75) / 3;
  const stdDev = partial.stdDev ?? Math.max(0, (p75 - p25) / 1.35);
  return {
    mean,
    median: partial.median ?? p50,
    stdDev,
    p10,
    p25,
    p50,
    p75,
    p90,
    sampleSize: partial.sampleSize ?? 0,
    confidence: partial.confidence ?? 0,
    unit: partial.unit,
    notes: partial.notes ?? 'heuristic placeholder',
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
