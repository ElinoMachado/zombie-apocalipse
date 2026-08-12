/** Ciclo dia/noite e raio de visão do jogador (tiles). */

/** Raio de visão nítida (metade do valor anterior). */
export const DAY_VISION_TILES = 4;
export const NIGHT_VISION_TILES = 2;

/**
 * Fração extra além da visão nítida até escuro total.
 * Ex.: 0.33 → penumbra de R até R*1.33.
 */
export const VISION_PENUMBRA_RATIO = 0.33;

/** Duração de cada metade do ciclo (dia ou noite): 12 minutos. */
export const HALF_DAY_MS = 12 * 60 * 1000;

export const VISION_MIN_TILES = 1;
export const VISION_MAX_TILES = 32;

export function visionOuterTiles(clearTiles: number): number {
  return clearTiles * (1 + VISION_PENUMBRA_RATIO);
}

export class DayNightCycle {
  private elapsed = 0;
  /** Se definido, ignora dia/noite (teste manual). */
  private overrideVision: number | null = null;

  constructor(private readonly halfDayMs = HALF_DAY_MS) {}

  reset(): void {
    this.elapsed = 0;
    this.overrideVision = null;
  }

  update(deltaMs: number): void {
    this.elapsed += deltaMs;
  }

  /** true = dia */
  get isDay(): boolean {
    const period = this.halfDayMs * 2;
    const t = this.elapsed % period;
    return t < this.halfDayMs;
  }

  get hasManualVision(): boolean {
    return this.overrideVision !== null;
  }

  /** Raio de visão nítida (tiles). */
  get visionTiles(): number {
    if (this.overrideVision !== null) return this.overrideVision;
    return this.isDay ? DAY_VISION_TILES : NIGHT_VISION_TILES;
  }

  /** Raio até escuro total (nítido + penumbra). */
  get visionOuterTiles(): number {
    return visionOuterTiles(this.visionTiles);
  }

  /** Ajuste manual (±tiles). Activa override. */
  adjustVision(deltaTiles: number): number {
    const base = this.overrideVision ?? this.visionTiles;
    this.overrideVision = Math.max(
      VISION_MIN_TILES,
      Math.min(VISION_MAX_TILES, base + deltaTiles),
    );
    return this.overrideVision;
  }

  setVision(tiles: number): number {
    this.overrideVision = Math.max(
      VISION_MIN_TILES,
      Math.min(VISION_MAX_TILES, Math.round(tiles)),
    );
    return this.overrideVision;
  }

  /** Volta ao raio automático dia/noite. */
  clearVisionOverride(): void {
    this.overrideVision = null;
  }

  /** 0 = amanhecer do dia actual, 1 = fim da noite */
  get phase01(): number {
    const period = this.halfDayMs * 2;
    return (this.elapsed % period) / period;
  }

  /**
   * Progresso da metade actual (dia ou noite): 0 → 1.
   * Usado pelo relógio — sol/lua completa uma volta por metade.
   */
  get halfPhase01(): number {
    const t = this.elapsed % (this.halfDayMs * 2);
    if (t < this.halfDayMs) return t / this.halfDayMs;
    return (t - this.halfDayMs) / this.halfDayMs;
  }

  get label(): string {
    return this.isDay ? 'Dia' : 'Noite';
  }
}
