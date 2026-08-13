import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

function isOpaque(a: number): boolean {
  return a >= 128;
}

function findBands(projection: number[]): [number, number][] {
  const bands: [number, number][] = [];
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
  if (inBand) bands.push([start, projection.length - 1]);
  return bands;
}

function analyze(file: string): void {
  const buf = fs.readFileSync(file);
  const png = PNG.sync.read(buf);
  const { width: w, height: h, data } = png;
  const rowProj = new Array<number>(h).fill(0);
  for (let y = 0; y < h; y += 1) {
    let s = 0;
    for (let x = 0; x < w; x += 1) {
      if (isOpaque(data[(y * w + x) * 4 + 3]!)) s += 1;
    }
    rowProj[y] = s;
  }
  const rowBands = findBands(rowProj);
  const colCounts: number[] = [];
  for (const [y0, y1] of rowBands) {
    const colProj = new Array<number>(w).fill(0);
    for (let x = 0; x < w; x += 1) {
      let s = 0;
      for (let y = y0; y <= y1; y += 1) {
        if (isOpaque(data[(y * w + x) * 4 + 3]!)) s += 1;
      }
      colProj[x] = s;
    }
    colCounts.push(findBands(colProj).length);
  }
  console.log(
    `${path.basename(file)} ${w}x${h} rows=${rowBands.length} colsPerRow=[${colCounts.join(', ')}]`,
  );
}

const dir = path.join(process.cwd(), 'public/assets/props');
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('_source.png')).sort()) {
  analyze(path.join(dir, f));
}
