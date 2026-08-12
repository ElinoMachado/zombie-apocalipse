/**
 * Distribuição empírica resumida (percentis).
 * Preferimos amostrar por quantis interpolados a inventar "médias rígidas".
 */
export interface Distribution {
  mean: number;
  median: number;
  stdDev: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  /** Tamanho da amostra que originou a distribuição (0 = placeholder heurístico). */
  sampleSize: number;
  /** 0–1; OSM incompleto → baixo. */
  confidence: number;
  unit?: string;
  notes?: string;
}

export type DataQuality = 'heuristic' | 'estimated' | 'observed' | 'insufficient';

export interface MetricMeta {
  quality: DataQuality;
  source?: string;
  sampleSize: number;
  confidence: number;
  notes?: string;
}

export interface InsufficientFlag {
  key: string;
  reason: string;
}
