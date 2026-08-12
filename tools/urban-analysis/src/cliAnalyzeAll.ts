import { listCityIds } from './cities';
import { analyzeCity } from './analyzeCity';
import { cachePath } from './overpass';
import fs from 'node:fs';

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  const ids = listCityIds();
  console.log(`Analisando ${ids.length} cidades (force=${force})…`);

  for (const cityId of ids) {
    const cached = fs.existsSync(cachePath(cityId));
    if (!force && cached) {
      console.log(`\n=== ${cityId} (cache) ===`);
    } else {
      console.log(`\n=== ${cityId} (fetch) ===`);
      // gentileza com Overpass
      await sleep(3000);
    }
    try {
      const { reportPath, report } = await analyzeCity({
        cityId,
        forceFetch: force,
      });
      console.log(
        `${cityId}: roads=${report.layers.roads} buildings=${report.layers.buildings} → ${reportPath}`,
      );
    } catch (e) {
      console.error(`${cityId} FALHOU:`, e instanceof Error ? e.message : e);
    }
  }

  console.log('\nPronto. Rode: npm run build:profiles');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
