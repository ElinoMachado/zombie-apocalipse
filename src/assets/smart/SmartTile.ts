/**
 * Seletor inteligente de tiles: cada célula escolhe o frame pela
 * tipagem + vizinhança (máscara N/E/S/W). Extensível a qualquer layer.
 */

export const DIR = { N: 1, E: 2, S: 4, W: 8 } as const;

export interface TilePlacement {
  /** Chave do spritesheet Phaser */
  textureKey: string;
  /** Índice do frame */
  frame: number;
}

/** Máscara 4-vizinhos a partir de um predicado de ligação. */
export function neighborMask4(
  x: number,
  y: number,
  connects: (nx: number, ny: number) => boolean,
): number {
  let mask = 0;
  if (connects(x, y - 1)) mask |= DIR.N;
  if (connects(x + 1, y)) mask |= DIR.E;
  if (connects(x, y + 1)) mask |= DIR.S;
  if (connects(x - 1, y)) mask |= DIR.W;
  return mask;
}

/**
 * Frame num atlas organizado como `rows × cols`,
 * onde a coluna é a máscara 0–15 e a linha é a variante tipológica.
 */
export function frameFromRowMask(
  row: number,
  mask: number,
  columns = 16,
): number {
  return row * columns + (mask & (columns - 1));
}

/**
 * Contrato de uma regra de tileset procedural.
 * `resolve` devolve null se a célula não deve pintar neste layer.
 */
export interface SmartTileRule<TContext> {
  id: string;
  textureKey: string;
  resolve(ctx: TContext, x: number, y: number): TilePlacement | null;
}

export function resolveSmartTile<TContext>(
  rule: SmartTileRule<TContext>,
  ctx: TContext,
  x: number,
  y: number,
): TilePlacement | null {
  return rule.resolve(ctx, x, y);
}
