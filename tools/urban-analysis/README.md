# tools/urban-analysis

CLI offline (Node) para análise OSM → métricas → City Profiles.

## Comandos

```bash
# Uma cidade
npm run analyze:city -- uberlandia
npm run analyze:city -- ituiutaba
npm run analyze:city -- goiania

# Todas as do catálogo (respeita cache; --force para re-fetch)
npm run analyze:all
npm run analyze:all -- --force

# Gerar profiles derivados + registo TypeScript
npm run build:profiles
```

## Saídas

| Caminho | Conteúdo |
|---------|----------|
| `tools/urban-analysis/cache/` | Overpass bruto (gitignore) |
| `profiles/raw-metrics/*.metrics.json` | Métricas por cidade |
| `profiles/derived/*.json` | CityProfiles |
| `src/world/profiles/generated/` | JSON + `OsmProfiles.ts` registados no runtime |

## Profiles gerados (amostra atual)

- `UberlandiaObserved`, `ItuiutabaObserved`, `GoianiaObserved`, `CampinasObserved`, `BeloHorizonteObserved`
- `BrazilianMediumCity` — merge ingénuo das cidades observed
- Blocks: faces do grafo viário (intersection→intersection) → `areaTiles` / aspect no profile

## Princípios

- Zero Phaser.
- Sem copiar geometria real para o gerador.
- Flags `INSUFFICIENT DATA` / `ESTIMATED` quando a amostra é fraca.
- Grafo viário: vértices partilhados (snap ~1.1 m) — `deadEndRatio` já não usa só endpoints de ways.
