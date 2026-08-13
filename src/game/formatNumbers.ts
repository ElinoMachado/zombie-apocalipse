/** Formata números do jogo com no máximo 1 casa decimal. */
export function formatGameNumber(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(1);
}

/** Percentagem 0–100 com 1 casa decimal. */
export function formatGamePercent(ratio: number): string {
  return `${formatGameNumber(ratio * 100)}%`;
}
