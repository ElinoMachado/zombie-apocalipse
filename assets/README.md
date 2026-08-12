# Assets

## Estradas (activo)

Tileset **procedural** do projecto — asfalto / rodovias com autotile 4-vizinhos:

```text
public/assets/tiles/roads/
  roads_packed.png   # 256×80 (16×16, 5 tipos × 16 máscaras)
  roads_packed.json
  README.md
```

Regenerar: `npm run build:tiles:roads`

Selecção inteligente: cada célula escolhe o frame por **tipo** (linha = identidade/marcações) + **máscara de vizinhos** (coluna). Ver [`src/assets/smart/`](../../src/assets/smart/).

## Outros packs (Kenney CC0, opcional)

```text
public/assets/
  tiles/
    urban/ town/ farm/ dungeon/
  sprites/props/
  previews/
```

Ver [CREDITS.md](./CREDITS.md) para Kenney.
