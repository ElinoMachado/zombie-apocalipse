/**
 * Tileset de calçada — cimento claro.
 *
 * Layout: 1 linha × 16 colunas, com 1px de extrusão (anti-bleeding).
 *   col = máscara de vizinhos (N=1 E=2 S=4 W=8)
 *   bermas mais escuras onde não há calçada/estrada adjacente
 *
 * Phaser: tileMargin=1, tileSpacing=2, tileSize=12.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../../public/assets/tiles/sidewalks');

const TILE = 12;
const PAD = 1;
const STRIDE = TILE + PAD * 2;
const COLS = 16;

type RGBA = [number, number, number, number];

const CEMENT: RGBA = [198, 200, 204, 255];
const CEMENT_VAR: RGBA = [188, 190, 194, 255];
const EDGE: RGBA = [168, 170, 174, 255];
const GROUT: RGBA = [176, 178, 182, 255];

function setPx(png: PNG, x: number, y: number, c: RGBA): void {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const i = (png.width * y + x) << 2;
  png.data[i] = c[0]!;
  png.data[i + 1] = c[1]!;
  png.data[i + 2] = c[2]!;
  png.data[i + 3] = c[3]!;
}

function getPx(png: PNG, x: number, y: number): RGBA {
  const i = (png.width * y + x) << 2;
  return [
    png.data[i]!,
    png.data[i + 1]!,
    png.data[i + 2]!,
    png.data[i + 3]!,
  ];
}

function paintTile(png: PNG, ox: number, oy: number, mask: number): void {
  const N = (mask & 1) !== 0;
  const E = (mask & 2) !== 0;
  const S = (mask & 4) !== 0;
  const W = (mask & 8) !== 0;

  for (let ly = 0; ly < TILE; ly++) {
    for (let lx = 0; lx < TILE; lx++) {
      const plate = ((lx >> 2) + (ly >> 2)) % 2 === 0;
      setPx(png, ox + lx, oy + ly, plate ? CEMENT : CEMENT_VAR);
    }
  }

  for (let i = 0; i < TILE; i++) {
    setPx(png, ox + 3, oy + i, GROUT);
    setPx(png, ox + 7, oy + i, GROUT);
    setPx(png, ox + i, oy + 3, GROUT);
    setPx(png, ox + i, oy + 7, GROUT);
  }

  for (let i = 0; i < TILE; i++) {
    if (!N) setPx(png, ox + i, oy + 0, EDGE);
    if (!S) setPx(png, ox + i, oy + TILE - 1, EDGE);
    if (!W) setPx(png, ox + 0, oy + i, EDGE);
    if (!E) setPx(png, ox + TILE - 1, oy + i, EDGE);
  }
}

function extrudeTile(png: PNG, cellX: number, cellY: number): void {
  const ox = cellX + PAD;
  const oy = cellY + PAD;
  for (let i = 0; i < TILE; i++) {
    setPx(png, ox + i, cellY, getPx(png, ox + i, oy));
    setPx(png, ox + i, cellY + STRIDE - 1, getPx(png, ox + i, oy + TILE - 1));
    setPx(png, cellX, oy + i, getPx(png, ox, oy + i));
    setPx(png, cellX + STRIDE - 1, oy + i, getPx(png, ox + TILE - 1, oy + i));
  }
  setPx(png, cellX, cellY, getPx(png, ox, oy));
  setPx(png, cellX + STRIDE - 1, cellY, getPx(png, ox + TILE - 1, oy));
  setPx(png, cellX, cellY + STRIDE - 1, getPx(png, ox, oy + TILE - 1));
  setPx(
    png,
    cellX + STRIDE - 1,
    cellY + STRIDE - 1,
    getPx(png, ox + TILE - 1, oy + TILE - 1),
  );
}

function main(): void {
  const png = new PNG({
    width: COLS * STRIDE,
    height: STRIDE,
    colorType: 6,
  });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 0;
    png.data[i + 1] = 0;
    png.data[i + 2] = 0;
    png.data[i + 3] = 0;
  }

  for (let mask = 0; mask < COLS; mask++) {
    const cellX = mask * STRIDE;
    paintTile(png, cellX + PAD, PAD, mask);
    extrudeTile(png, cellX, 0);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPng = path.join(OUT_DIR, 'sidewalks_packed.png');
  fs.writeFileSync(outPng, PNG.sync.write(png));

  fs.writeFileSync(
    path.join(OUT_DIR, 'sidewalks_packed.json'),
    JSON.stringify(
      {
        tileSize: TILE,
        pad: PAD,
        stride: STRIDE,
        margin: PAD,
        spacing: PAD * 2,
        columns: COLS,
        rows: 1,
        mask: 'N=1 E=2 S=4 W=8',
      },
      null,
      2,
    ),
  );

  console.log(`Wrote ${outPng} (${png.width}×${png.height}, pad=${PAD})`);
}

main();
