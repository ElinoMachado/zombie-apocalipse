# profiles/

Artefatos de **City Profiles**.

| Pasta | Conteúdo |
|-------|----------|
| `raw-metrics/` | Relatórios por cidade OSM (gerados pelo tools; PBF não entra no git) |
| `derived/` | Profiles agregados versionados (JSON) |
| `meta/` | Cobertura, confiança, notas de amostra |

O profile runtime canónico em TypeScript vive em `src/world/profiles/`.
JSON aqui serve para inspeção e para a futura Fase 3/4 (OSM → profile).

**Nunca** versionar geometrias OSM completas — só métricas e parâmetros amostráveis.
