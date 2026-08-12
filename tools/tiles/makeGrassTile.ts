import { PNG } from 'pngjs';
import fs from 'fs';

const src = PNG.sync.read(
  fs.readFileSync('public/assets/tiles/grass/grass_tileable.png'),
);
const size = 64;
const out = new PNG({ width: size, height: size });
const scale = src.width / size;
for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    const sx = Math.min(src.width - 1, Math.floor(x * scale));
    const sy = Math.min(src.height - 1, Math.floor(y * scale));
    const si = (sy * src.width + sx) * 4;
    const di = (y * size + x) * 4;
    out.data[di] = src.data[si]!;
    out.data[di + 1] = src.data[si + 1]!;
    out.data[di + 2] = src.data[si + 2]!;
    out.data[di + 3] = 255;
  }
}
fs.writeFileSync('public/assets/tiles/grass/grass_64.png', PNG.sync.write(out));
console.log('wrote grass_64.png', size);
