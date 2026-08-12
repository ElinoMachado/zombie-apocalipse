# Como Sobreviver ao Apocalipse

Jogo top-down de exploração com **World Generator** procedural puro (TypeScript) + render Phaser.

## Arquitetura

```text
generateWorld(seed)  →  World data  →  Phaser WorldDebugRenderer
                     ↘  formatWorldSummary() / console
```

O código em `src/world/` **não importa Phaser**.

## Assets

Packs CC0 (Kenney) ficam em [`public/assets/`](public/assets/) para uso futuro — o mapa debug atual usa placeholders coloridos.

## City Profiles (Fase 2–4)

```bash
npm test
npm run analyze:city -- uberlandia
npm run analyze:all          # mais cidades (cache Overpass)
npm run build:profiles       # → BrazilianMediumCity + *Observed
```

Runtime: `generateWorld({ profileId: 'BrazilianMediumCity' })`  
UI: seletor de profile (default visual `BrazilianMediumCity`).  
Pipeline: roads / zones (centerRadius) / lots / empty-lot / **poiRules** no scoring + quotas; dump inclui fit estatístico vs profile.

## Desenvolvimento

```bash
npm install
npm run dev
```

Clique em **Gerar cidade**. Arrastar = pan, scroll = zoom, setas = mover.
