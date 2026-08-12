import fs from 'fs';
import { PNG } from 'pngjs';

function analyze(path: string, tw = 16) {
  const png = PNG.sync.read(fs.readFileSync(path));
  const cols = Math.floor(png.width / tw);
  const rows = Math.floor(png.height / tw);
  const tiles: { i: number; r: number; g: number; b: number; label: string }[] =
    [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let R = 0,
        G = 0,
        B = 0,
        n = 0;
      for (let y = 0; y < tw; y++) {
        for (let x = 0; x < tw; x++) {
          const px = ((row * tw + y) * png.width + (col * tw + x)) * 4;
          const a = png.data[px + 3]!;
          if (a < 16) continue;
          R += png.data[px]!;
          G += png.data[px + 1]!;
          B += png.data[px + 2]!;
          n++;
        }
      }
      if (n < tw * tw * 0.2) continue;
      R /= n;
      G /= n;
      B /= n;
      let label = 'other';
      if (G > R + 15 && G > B + 15 && G > 90) label = 'grass';
      else if (B > R + 20 && B > G + 10 && B > 100) label = 'water';
      else if (Math.abs(R - G) < 18 && Math.abs(G - B) < 18 && R < 90)
        label = 'asphalt';
      else if (
        Math.abs(R - G) < 25 &&
        Math.abs(G - B) < 25 &&
        R >= 90 &&
        R < 160
      )
        label = 'sidewalk';
      else if (R > 120 && R > G + 20 && R > B + 20) label = 'brick';
      else if (R > 100 && G > 70 && B < 70 && R > B + 30) label = 'roof_brown';
      tiles.push({ i: row * cols + col, r: R | 0, g: G | 0, b: B | 0, label });
    }
  }
  const by: Record<string, number[]> = {};
  for (const t of tiles) (by[t.label] ??= []).push(t.i);
  console.log(path, `${png.width}x${png.height}`, `grid ${cols}x${rows}`);
  for (const [k, v] of Object.entries(by)) {
    console.log(`  ${k}: ${v.length} e.g. [${v.slice(0, 15).join(', ')}]`);
  }
}

analyze('public/assets/tiles/urban/tilemap_packed.png');
analyze('public/assets/tiles/town/tilemap_packed.png');
analyze('public/assets/tiles/farm/tilemap_packed.png');
analyze('public/assets/tiles/dungeon/tilemap_packed.png');
