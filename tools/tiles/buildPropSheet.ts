import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

export interface PropSheetConfig {
  /** Ficheiro em public/assets/props (ex.: backpacks_source.png). */
  source: string;
  outSheet: string;
  outMeta: string;
  cols: number;
  rows: number;
}

export interface PropSheetMeta {
  source: string;
  cols: number;
  rows: number;
  frameWidth: number;
  frameHeight: number;
  sheetWidth: number;
  sheetHeight: number;
  cells: number;
}

function isOpaque(a: number): boolean {
  return a >= 128;
}

function isContentPixel(data: Buffer, width: number, x: number, y: number): boolean {
  return isOpaque(data[(y * width + x) * 4 + 3]!);
}

function findContentBands(projection: number[]): Array<[number, number]> {
  const bands: Array<[number, number]> = [];
  let inBand = false;
  let start = 0;
  for (let i = 0; i < projection.length; i += 1) {
    const has = projection[i]! > 0;
    if (has && !inBand) {
      start = i;
      inBand = true;
    } else if (!has && inBand) {
      bands.push([start, i - 1]);
      inBand = false;
    }
  }
  if (inBand) {
    bands.push([start, projection.length - 1]);
  }
  return bands;
}

function writePropSheetFromCells(
  propsDir: string,
  cfg: Pick<PropSheetConfig, 'source' | 'outSheet' | 'outMeta' | 'cols' | 'rows'>,
  sw: number,
  sh: number,
  data: Buffer,
  cells: Array<{
    row: number;
    col: number;
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  }>,
): PropSheetMeta {
  let maxW = 0;
  let maxH = 0;
  for (const cell of cells) {
    const cw = cell.x1 - cell.x0 + 1;
    const ch = cell.y1 - cell.y0 + 1;
    if (cw > maxW) maxW = cw;
    if (ch > maxH) maxH = ch;
  }

  const outW = maxW * cfg.cols;
  const outH = maxH * cfg.rows;
  const out = new PNG({ width: outW, height: outH });

  for (let i = 0; i < out.data.length; i += 4) {
    out.data[i] = 0;
    out.data[i + 1] = 0;
    out.data[i + 2] = 0;
    out.data[i + 3] = 0;
  }

  for (const cell of cells) {
    const cw = cell.x1 - cell.x0 + 1;
    const ch = cell.y1 - cell.y0 + 1;
    const dx0 = cell.col * maxW + Math.floor((maxW - cw) / 2);
    const dy0 = cell.row * maxH + Math.floor((maxH - ch) / 2);

    for (let y = 0; y < ch; y += 1) {
      for (let x = 0; x < cw; x += 1) {
        const sx = cell.x0 + x;
        const sy = cell.y0 + y;
        const si = (sy * sw + sx) * 4;
        const di = ((dy0 + y) * outW + (dx0 + x)) * 4;
        const a = data[si + 3]!;
        if (!isOpaque(a)) continue;
        out.data[di] = data[si]!;
        out.data[di + 1] = data[si + 1]!;
        out.data[di + 2] = data[si + 2]!;
        out.data[di + 3] = 255;
      }
    }
  }

  const outSheetPath = path.join(propsDir, cfg.outSheet);
  const outMetaPath = path.join(propsDir, cfg.outMeta);
  const tmpPath = `${outSheetPath}.tmp`;
  fs.writeFileSync(tmpPath, PNG.sync.write(out));
  if (fs.existsSync(outSheetPath)) fs.unlinkSync(outSheetPath);
  fs.renameSync(tmpPath, outSheetPath);

  const meta: PropSheetMeta = {
    source: cfg.source,
    cols: cfg.cols,
    rows: cfg.rows,
    frameWidth: maxW,
    frameHeight: maxH,
    sheetWidth: outW,
    sheetHeight: outH,
    cells: cells.length,
  };
  fs.writeFileSync(outMetaPath, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
  return meta;
}

function cellOpaqueBounds(
  data: Buffer,
  width: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): { x0: number; y0: number; x1: number; y1: number } | null {
  let minX = x1;
  let minY = y1;
  let maxX = x0;
  let maxY = y0;
  let found = false;

  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const a = data[(y * width + x) * 4 + 3]!;
      if (!isOpaque(a)) continue;
      found = true;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (!found) return null;
  return { x0: minX, y0: minY, x1: maxX, y1: maxY };
}

export function buildPropSheet(
  propsDir: string,
  cfg: PropSheetConfig,
): PropSheetMeta {
  const srcPath = path.join(propsDir, cfg.source);
  if (!fs.existsSync(srcPath)) {
    throw new Error(`Fonte não encontrada: ${srcPath}`);
  }

  const src = PNG.sync.read(fs.readFileSync(srcPath));
  const { width: sw, height: sh, data } = src;
  const cellW = Math.floor(sw / cfg.cols);
  const cellH = Math.floor(sh / cfg.rows);

  const cells: Array<{
    row: number;
    col: number;
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  }> = [];
  for (let row = 0; row < cfg.rows; row += 1) {
    for (let col = 0; col < cfg.cols; col += 1) {
      const gx0 = col * cellW;
      const gy0 = row * cellH;
      const gx1 = col === cfg.cols - 1 ? sw - 1 : (col + 1) * cellW - 1;
      const gy1 = row === cfg.rows - 1 ? sh - 1 : (row + 1) * cellH - 1;
      const b = cellOpaqueBounds(data, sw, gx0, gy0, gx1, gy1);
      if (!b) {
        throw new Error(
          `${cfg.source}: célula vazia row=${row} col=${col} (${gx0},${gy0})-(${gx1},${gy1})`,
        );
      }
      cells.push({ row, col, x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 });
    }
  }

  return writePropSheetFromCells(propsDir, cfg, sw, sh, data, cells);
}

/**
 * Recorta sprites por bandas de conteúdo (alpha) — evita cortar carros pela metade
 * quando a grelha fixa não coincide com o layout da folha.
 */
export function buildPropSheetByBands(
  propsDir: string,
  cfg: PropSheetConfig,
): PropSheetMeta {
  const srcPath = path.join(propsDir, cfg.source);
  if (!fs.existsSync(srcPath)) {
    throw new Error(`Fonte não encontrada: ${srcPath}`);
  }

  const src = PNG.sync.read(fs.readFileSync(srcPath));
  const { width: sw, height: sh, data } = src;

  const rowProj = new Array<number>(sh).fill(0);
  for (let y = 0; y < sh; y += 1) {
    let sum = 0;
    for (let x = 0; x < sw; x += 1) {
      if (isContentPixel(data, sw, x, y)) sum += 1;
    }
    rowProj[y] = sum;
  }

  const rowBands = findContentBands(rowProj);
  if (rowBands.length !== cfg.rows) {
    throw new Error(
      `${cfg.source}: esperadas ${cfg.rows} linhas de conteúdo, detectadas ${rowBands.length}`,
    );
  }

  const cells: Array<{
    row: number;
    col: number;
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  }> = [];

  for (let row = 0; row < cfg.rows; row += 1) {
    const [y0, y1] = rowBands[row]!;
    const colProj = new Array<number>(sw).fill(0);
    for (let x = 0; x < sw; x += 1) {
      let sum = 0;
      for (let y = y0; y <= y1; y += 1) {
        if (isContentPixel(data, sw, x, y)) sum += 1;
      }
      colProj[x] = sum;
    }

    const colBands = findContentBands(colProj);
    if (colBands.length !== cfg.cols) {
      throw new Error(
        `${cfg.source}: linha ${row} — esperadas ${cfg.cols} colunas, detectadas ${colBands.length}`,
      );
    }

    for (let col = 0; col < cfg.cols; col += 1) {
      const [x0, x1] = colBands[col]!;
      cells.push({ row, col, x0, y0, x1, y1 });
    }
  }

  return writePropSheetFromCells(propsDir, cfg, sw, sh, data, cells);
}
