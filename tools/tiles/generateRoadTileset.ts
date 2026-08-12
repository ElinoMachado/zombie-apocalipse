/**
 * Tileset de estradas — bancos de marcação com offset para vias largas.
 *
 * Layout: 35 linhas × 16 colunas, cada célula com 1px de extrusão (anti-bleeding).
 *   row = typeIndex * 7 + markMode
 *   markMode:
 *     0 none
 *     1 NS centro · 2 EW centro
 *     3 NS esquerda · 4 NS direita  (offset p/ espessura par)
 *     5 EW cima · 6 EW baixo
 *   col = máscara de vizinhos (bermas)
 *
 * Phaser: tileMargin=1, tileSpacing=2, tileSize=12.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../../public/assets/tiles/roads');

const TILE = 12;
const PAD = 1;
const STRIDE = TILE + PAD * 2;
const COLS = 16;
const TYPES = 5;
const MARK_MODES = 7;
const ROWS = TYPES * MARK_MODES;

type RGBA = [number, number, number, number];
type MarkStyle = 'double-yellow' | 'dash-white' | 'dash-white-dim';

interface RoadStyle {
  id: string;
  asphalt: RGBA;
  curb: RGBA;
  mark: RGBA;
  markAlt: RGBA;
  marks: MarkStyle;
}

const ASPHALT: RGBA = [60, 62, 66, 255];
const CURB: RGBA = [40, 42, 46, 255];

const STYLES: RoadStyle[] = [
  {
    id: 'highway',
    asphalt: ASPHALT,
    curb: CURB,
    mark: [236, 200, 52, 255],
    markAlt: [210, 175, 42, 255],
    marks: 'double-yellow',
  },
  {
    id: 'main',
    asphalt: ASPHALT,
    curb: CURB,
    mark: [236, 236, 230, 255],
    markAlt: [200, 200, 195, 255],
    marks: 'dash-white',
  },
  {
    id: 'avenue',
    asphalt: ASPHALT,
    curb: CURB,
    mark: [228, 228, 224, 255],
    markAlt: [190, 190, 186, 255],
    marks: 'dash-white',
  },
  {
    id: 'street',
    asphalt: ASPHALT,
    curb: CURB,
    mark: [220, 220, 218, 255],
    markAlt: [180, 180, 178, 255],
    marks: 'dash-white',
  },
  {
    id: 'residential',
    asphalt: ASPHALT,
    curb: CURB,
    mark: [200, 196, 188, 255],
    markAlt: [160, 156, 148, 255],
    marks: 'dash-white-dim',
  },
];

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

function dashOn(i: number, period = 4, on = 2): boolean {
  return i % period < on;
}

/** lx = coluna da faixa (NS). */
function paintMarksNS(
  png: PNG,
  ox: number,
  oy: number,
  style: RoadStyle,
  lx: number,
): void {
  const on = style.marks === 'dash-white-dim' ? 1 : 2;
  if (style.marks === 'double-yellow') {
    for (let y = 0; y < TILE; y++) {
      setPx(png, ox + lx - 1, oy + y, style.mark);
      setPx(png, ox + lx + 1, oy + y, style.markAlt);
    }
    return;
  }
  for (let y = 0; y < TILE; y++) {
    if (!dashOn(y, 4, on)) continue;
    setPx(png, ox + lx, oy + y, style.mark);
    if (style.marks !== 'dash-white-dim') {
      setPx(png, ox + lx - 1, oy + y, style.markAlt);
    }
  }
}

/** ly = linha da faixa (EW). */
function paintMarksEW(
  png: PNG,
  ox: number,
  oy: number,
  style: RoadStyle,
  ly: number,
): void {
  const on = style.marks === 'dash-white-dim' ? 1 : 2;
  if (style.marks === 'double-yellow') {
    for (let x = 0; x < TILE; x++) {
      setPx(png, ox + x, oy + ly - 1, style.mark);
      setPx(png, ox + x, oy + ly + 1, style.markAlt);
    }
    return;
  }
  for (let x = 0; x < TILE; x++) {
    if (!dashOn(x, 4, on)) continue;
    setPx(png, ox + x, oy + ly, style.mark);
    if (style.marks !== 'dash-white-dim') {
      setPx(png, ox + x, oy + ly - 1, style.markAlt);
    }
  }
}

function markOffset(markMode: number): { axis: 'NS' | 'EW'; pos: number } | null {
  const mid = (TILE / 2) | 0; // 6
  const left = 3;
  const right = TILE - 4; // 8
  const top = 3;
  const bottom = TILE - 4;
  switch (markMode) {
    case 1:
      return { axis: 'NS', pos: mid };
    case 2:
      return { axis: 'EW', pos: mid };
    case 3:
      return { axis: 'NS', pos: left };
    case 4:
      return { axis: 'NS', pos: right };
    case 5:
      return { axis: 'EW', pos: top };
    case 6:
      return { axis: 'EW', pos: bottom };
    default:
      return null;
  }
}

function paintTile(
  png: PNG,
  ox: number,
  oy: number,
  style: RoadStyle,
  mask: number,
  markMode: number,
): void {
  const N = (mask & 1) !== 0;
  const E = (mask & 2) !== 0;
  const S = (mask & 4) !== 0;
  const W = (mask & 8) !== 0;

  for (let ly = 0; ly < TILE; ly++) {
    for (let lx = 0; lx < TILE; lx++) {
      setPx(png, ox + lx, oy + ly, style.asphalt);
    }
  }

  for (let i = 0; i < TILE; i++) {
    if (!N) setPx(png, ox + i, oy + 0, style.curb);
    if (!S) setPx(png, ox + i, oy + TILE - 1, style.curb);
    if (!W) setPx(png, ox + 0, oy + i, style.curb);
    if (!E) setPx(png, ox + TILE - 1, oy + i, style.curb);
  }

  const off = markOffset(markMode);
  if (!off) return;
  if (off.axis === 'NS') paintMarksNS(png, ox, oy, style, off.pos);
  else paintMarksEW(png, ox, oy, style, off.pos);
}

/** Copia as arestas do tile lógico para o anel de PAD (extrusão). */
function extrudeTile(png: PNG, cellX: number, cellY: number): void {
  const ox = cellX + PAD;
  const oy = cellY + PAD;
  for (let i = 0; i < TILE; i++) {
    // top / bottom
    setPx(png, ox + i, cellY, getPx(png, ox + i, oy));
    setPx(png, ox + i, cellY + STRIDE - 1, getPx(png, ox + i, oy + TILE - 1));
    // left / right
    setPx(png, cellX, oy + i, getPx(png, ox, oy + i));
    setPx(png, cellX + STRIDE - 1, oy + i, getPx(png, ox + TILE - 1, oy + i));
  }
  // corners
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
    height: ROWS * STRIDE,
    colorType: 6,
  });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 0;
    png.data[i + 1] = 0;
    png.data[i + 2] = 0;
    png.data[i + 3] = 0;
  }

  for (let type = 0; type < TYPES; type++) {
    const style = STYLES[type]!;
    for (let markMode = 0; markMode < MARK_MODES; markMode++) {
      const row = type * MARK_MODES + markMode;
      for (let mask = 0; mask < COLS; mask++) {
        const cellX = mask * STRIDE;
        const cellY = row * STRIDE;
        paintTile(png, cellX + PAD, cellY + PAD, style, mask, markMode);
        extrudeTile(png, cellX, cellY);
      }
    }
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPng = path.join(OUT_DIR, 'roads_packed.png');
  fs.writeFileSync(outPng, PNG.sync.write(png));

  fs.writeFileSync(
    path.join(OUT_DIR, 'roads_packed.json'),
    JSON.stringify(
      {
        tileSize: TILE,
        pad: PAD,
        stride: STRIDE,
        margin: PAD,
        spacing: PAD * 2,
        columns: COLS,
        rows: ROWS,
        markModes: {
          0: 'none',
          1: 'NS-center',
          2: 'EW-center',
          3: 'NS-left',
          4: 'NS-right',
          5: 'EW-top',
          6: 'EW-bottom',
        },
        selection:
          'frame=(type*7+markMode)*16+mask; type=dominant segment; markMode=centerline+offset',
      },
      null,
      2,
    ),
  );

  fs.writeFileSync(
    path.join(OUT_DIR, 'README.md'),
    `# Road tileset (${TILE}×${TILE}, pad ${PAD})

\`frame = (type*7 + markMode)*16 + mask\`

Phaser: \`tileMargin=${PAD}\`, \`tileSpacing=${PAD * 2}\`

Mark modes: 0 none · 1/2 center · 3/4 NS offset · 5/6 EW offset

\`npm run build:tiles:roads\`
`,
  );

  console.log(`Wrote ${outPng} (${png.width}×${png.height}, rows=${ROWS}, pad=${PAD})`);
}

main();
