/** Chaves e caminhos dos assets em /public/assets (servidos na raiz). */
import {
  WRECKED_CAR_FRAME_H,
  WRECKED_CAR_FRAME_W,
} from './wreckedCars';

/** Tamanho do tile de estrada (= city.tileSize por defeito). */
export const TILE_SIZE = 12;
/**
 * Atlas de estradas/calçadas: 1px extrudido por lado (anti-bleeding).
 * Phaser: margem = PAD, spacing = PAD*2.
 */
export const TILE_ATLAS_PAD = 1;
export const TILE_ATLAS_MARGIN = TILE_ATLAS_PAD;
export const TILE_ATLAS_SPACING = TILE_ATLAS_PAD * 2;
/** Tamanho dos tiles Kenney (farm/town/urban) — só props legado. */
export const KENNEY_TILE_SIZE = 16;
/** Tile de grama (textura tileable do utilizador). */
export const GRASS_TILE_SIZE = 64;

export const AssetKeys = {
  roads: 'tiles-roads',
  sidewalks: 'tiles-sidewalks',
  /** Solo de grama (única textura de terreno activa). */
  grass: 'tiles-grass',
  /** Spritesheets 16×16 Kenney — fallback. */
  urbanSheet: 'tiles-urban-sheet',
  townSheet: 'tiles-town-sheet',
  farmSheet: 'tiles-farm-sheet',
  dungeon: 'tiles-dungeon',
  wreckedCars: 'props-wrecked-cars',
  lixeiras: 'props-lixeiras',
  geradores: 'props-geradores',
  pessoasMortas: 'props-pessoas-mortas',
  crateBoxes: 'props-crate-boxes',
  backpacks: 'props-backpacks',
  containers: 'props-containers',
  malas: 'props-malas',
  cofres: 'props-cofres',
  maquinas: 'props-maquinas',
} as const;

export type AssetKey = (typeof AssetKeys)[keyof typeof AssetKeys];

export interface TilesetImageSpec {
  key: AssetKey;
  url: string;
  frameWidth?: number;
  frameHeight?: number;
}

const KENNEY_URLS = {
  urban: 'assets/tiles/urban/tilemap_packed.png',
  town: 'assets/tiles/town/tilemap_packed.png',
  farm: 'assets/tiles/farm/tilemap_packed.png',
} as const;

/**
 * Activos no boot: estradas, calçadas, grama do utilizador.
 * Sem tilemaps Kenney de terreno (urban/town/farm image).
 */
export const TILESHEETS: TilesetImageSpec[] = [
  {
    key: AssetKeys.roads,
    url: 'assets/tiles/roads/roads_packed.png?v=35r8-extrude',
  },
  {
    key: AssetKeys.sidewalks,
    url: 'assets/tiles/sidewalks/sidewalks_packed.png?v=2-extrude',
  },
  {
    key: AssetKeys.grass,
    url: 'assets/tiles/grass/grass_64.png',
  },
  {
    key: AssetKeys.urbanSheet,
    url: KENNEY_URLS.urban,
    frameWidth: KENNEY_TILE_SIZE,
    frameHeight: KENNEY_TILE_SIZE,
  },
  {
    key: AssetKeys.townSheet,
    url: KENNEY_URLS.town,
    frameWidth: KENNEY_TILE_SIZE,
    frameHeight: KENNEY_TILE_SIZE,
  },
  {
    key: AssetKeys.farmSheet,
    url: KENNEY_URLS.farm,
    frameWidth: KENNEY_TILE_SIZE,
    frameHeight: KENNEY_TILE_SIZE,
  },
  {
    key: AssetKeys.wreckedCars,
    url: 'assets/props/wrecked_cars_sheet.png?v=7',
    frameWidth: WRECKED_CAR_FRAME_W,
    frameHeight: WRECKED_CAR_FRAME_H,
  },
  {
    key: AssetKeys.lixeiras,
    url: 'assets/props/lixeira_sheet.png?v=4',
    frameWidth: 361,
    frameHeight: 461,
  },
  {
    key: AssetKeys.geradores,
    url: 'assets/props/geradores_sheet.png?v=4',
    frameWidth: 437,
    frameHeight: 341,
  },
  {
    key: AssetKeys.pessoasMortas,
    url: 'assets/props/pessoas_mortas_sheet.png?v=4',
    frameWidth: 384,
    frameHeight: 469,
  },
  {
    key: AssetKeys.crateBoxes,
    url: 'assets/props/crate_boxes_sheet.png?v=4',
    frameWidth: 379,
    frameHeight: 382,
  },
  {
    key: AssetKeys.backpacks,
    url: 'assets/props/backpacks_sheet.png?v=4',
    frameWidth: 363,
    frameHeight: 415,
  },
  {
    key: AssetKeys.containers,
    url: 'assets/props/containers_sheet.png?v=4',
    frameWidth: 538,
    frameHeight: 313,
  },
  {
    key: AssetKeys.malas,
    url: 'assets/props/malas_sheet.png?v=4',
    frameWidth: 384,
    frameHeight: 491,
  },
  {
    key: AssetKeys.cofres,
    url: 'assets/props/cofre_sheet.png?v=1',
    frameWidth: 390,
    frameHeight: 370,
  },
  {
    key: AssetKeys.maquinas,
    url: 'assets/props/machine_sheet.png?v=1',
    frameWidth: 284,
    frameHeight: 421,
  },
];

export const OPTIONAL_TILESHEETS: TilesetImageSpec[] = [
  {
    key: AssetKeys.dungeon,
    url: 'assets/tiles/dungeon/tilemap_packed.png',
    frameWidth: KENNEY_TILE_SIZE,
    frameHeight: KENNEY_TILE_SIZE,
  },
];

/** Preload de tilesets activos. */
export function preloadTilesheets(scene: {
  load: {
    image: (key: string, url: string) => void;
    spritesheet: (
      key: string,
      url: string,
      config: { frameWidth: number; frameHeight: number },
    ) => void;
  };
}): void {
  for (const sheet of TILESHEETS) {
    if (sheet.frameWidth && sheet.frameHeight) {
      scene.load.spritesheet(sheet.key, sheet.url, {
        frameWidth: sheet.frameWidth,
        frameHeight: sheet.frameHeight,
      });
    } else {
      scene.load.image(sheet.key, sheet.url);
    }
  }
}
