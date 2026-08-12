import fs from 'fs';
import { PNG } from 'pngjs';

const path = 'public/assets/tiles/urban/tilemap_packed.png';
const tw = 16;
const png = PNG.sync.read(fs.readFileSync(path));
const cols = Math.floor(png.width / tw);
const rows = Math.floor(png.height / tw);

type T = { i: number; r: number; g: number; b: number; sat: number };
const tiles: T[] = [];

for (let row = 0; row < rows; row++) {
  for (let col = 0; col < cols; col++) {
    let R = 0,
      G = 0,
      B = 0,
      n = 0;
    for (let y = 0; y < tw; y++) {
      for (let x = 0; x < tw; x++) {
        const px = ((row * tw + y) * png.width + (col * tw + x)) * 4;
        if (png.data[px + 3]! < 16) continue;
        R += png.data[px]!;
        G += png.data[px + 1]!;
        B += png.data[px + 2]!;
        n++;
      }
    }
    if (n < 50) continue;
    R /= n;
    G /= n;
    B /= n;
    const max = Math.max(R, G, B);
    const min = Math.min(R, G, B);
    tiles.push({
      i: row * cols + col,
      r: R | 0,
      g: G | 0,
      b: B | 0,
      sat: max - min,
    });
  }
}

const grayish = tiles
  .filter((t) => t.sat < 25 && t.r > 40 && t.r < 140)
  .sort((a, b) => a.r - b.r);

console.log('gray-ish road candidates (low sat):');
for (const t of grayish.slice(0, 40)) {
  console.log(`  #${t.i} rgb(${t.r},${t.g},${t.b}) sat=${t.sat | 0}`);
}
