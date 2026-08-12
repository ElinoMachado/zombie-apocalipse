import { PNG } from 'pngjs';
import fs from 'fs';

const png = PNG.sync.read(
  fs.readFileSync('public/assets/tiles/nature/nature_sheet.png'),
);
console.log('size', png.width, png.height);

function extract(tw: number, cols: number, indices: number[], outDir: string) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const idx of indices) {
    const tx = idx % cols;
    const ty = Math.floor(idx / cols);
    const tile = new PNG({ width: tw, height: tw });
    for (let py = 0; py < tw; py++) {
      for (let px = 0; px < tw; px++) {
        const sx = tx * tw + px;
        const sy = ty * tw + py;
        if (sx >= png.width || sy >= png.height) continue;
        const si = (sy * png.width + sx) * 4;
        const di = (py * tw + px) * 4;
        tile.data[di] = png.data[si]!;
        tile.data[di + 1] = png.data[si + 1]!;
        tile.data[di + 2] = png.data[si + 2]!;
        tile.data[di + 3] = png.data[si + 3]!;
      }
    }
    fs.writeFileSync(`${outDir}/${idx}.png`, PNG.sync.write(tile));
  }
  console.log('extracted', indices.length, 'at', tw, 'cols', cols);
}

// try 64x64, 16 cols
extract(64, 16, [0, 1, 80, 81, 96, 97, 112, 128, 144, 160], 'tools/tiles/_nature64');
// try 32x32, 32 cols  
extract(32, 32, [0, 1, 160, 161, 192, 193], 'tools/tiles/_nature32');
