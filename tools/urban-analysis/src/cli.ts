import { analyzeCity } from './analyzeCity';
import { CITY_TARGETS } from './cities';

function parseArgs(argv: string[]): { cityId: string; force: boolean } {
  let cityId = 'uberlandia';
  let force = false;
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--' || a === '') continue;
    if (a === '--city' && argv[i + 1]) {
      cityId = argv[++i]!;
    } else if (a.startsWith('--city=')) {
      cityId = a.slice('--city='.length);
    } else if (a === '--force') {
      force = true;
    } else if (a === '--help' || a === '-h') {
      console.log(`Usage:
  npm run analyze:city
  npm run analyze:city -- uberlandia
  npm run analyze:city -- --city=uberlandia --force

Cities: ${Object.keys(CITY_TARGETS).join(', ')}
`);
      process.exit(0);
    } else if (!a.startsWith('-')) {
      positional.push(a);
    }
  }

  if (positional[0] && CITY_TARGETS[positional[0]]) {
    cityId = positional[0];
  }

  return { cityId, force };
}

async function main(): Promise<void> {
  const { cityId, force } = parseArgs(process.argv.slice(2));
  console.log(`Analisando ${cityId}${force ? ' (force fetch)' : ''}…`);
  const { reportPath, markdown, report } = await analyzeCity({
    cityId,
    forceFetch: force,
  });
  console.log(markdown);
  console.log(`\nReport: ${reportPath}`);
  console.log(`INSUFFICIENT flags: ${report.insufficientSummary.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
