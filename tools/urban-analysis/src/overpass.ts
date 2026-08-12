import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CityTarget } from './cities';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const CACHE_DIR = path.resolve(__dirname, '../cache');

const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/cgi/interpreter',
];

export function buildOverpassQuery(bbox: CityTarget['bbox']): string {
  const [s, w, n, e] = bbox;
  const box = `${s},${w},${n},${e}`;
  // Query um pouco mais leve: sem landuse ways (menos dados) no MVP
  return `
[out:json][timeout:180];
(
  way["highway"](${box});
  way["building"](${box});
  node["amenity"](${box});
  node["shop"](${box});
  way["amenity"~"hospital|clinic|school|police|fuel|fire_station|place_of_worship|pharmacy|university|college|parking|restaurant|fast_food|cafe|doctors"](${box});
  way["shop"~"supermarket|convenience"](${box});
);
out body geom;
`;
}

export function cachePath(cityId: string): string {
  return path.join(CACHE_DIR, `${cityId}.overpass.json`);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

export async function fetchOverpass(
  city: CityTarget,
  opts?: { force?: boolean },
): Promise<{ data: unknown; fromCache: boolean; path: string }> {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const file = cachePath(city.id);

  if (!opts?.force && fs.existsSync(file)) {
    const raw = fs.readFileSync(file, 'utf8');
    return { data: JSON.parse(raw), fromCache: true, path: file };
  }

  const query = buildOverpassQuery(city.bbox);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) {
      const wait = 5000 * attempt;
      console.warn(`Overpass retry ${attempt} em ${wait}ms…`);
      await sleep(wait);
    }

    for (const url of OVERPASS_URLS) {
      try {
        console.warn(`Overpass POST ${url}`);
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'ComoSobreviverAoApocalipse-urban-analysis/0.1 (solo-dev)',
          },
          body: `data=${encodeURIComponent(query)}`,
        });
        if (res.status === 429 || res.status === 504 || res.status === 502) {
          lastError = new Error(`Overpass HTTP ${res.status} @ ${url}`);
          continue;
        }
        if (!res.ok) {
          lastError = new Error(`Overpass HTTP ${res.status} @ ${url}`);
          continue;
        }
        const data = await res.json();
        fs.writeFileSync(file, JSON.stringify(data));
        return { data, fromCache: false, path: file };
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
      }
    }
  }

  throw lastError ?? new Error('Overpass fetch failed');
}
