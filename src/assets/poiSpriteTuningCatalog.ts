import { TILE_SIZE } from './manifest';
import {
  BACKPACK_POI_TYPE_ID,
  backpackDisplayScale,
  BACKPACK_COLS,
  BACKPACK_FRAME_COUNT,
  BACKPACK_FRAME_H,
  BACKPACK_FRAME_W,
  BACKPACK_ROWS,
  stableBackpackRotation,
} from './backpacks';
import {
  CONTAINER_POI_TYPE_ID,
  containerDisplayScale,
  CONTAINER_COLS,
  CONTAINER_FRAME_COUNT,
  CONTAINER_FRAME_H,
  CONTAINER_FRAME_W,
  CONTAINER_ROWS,
  stableContainerRotation,
} from './containers';
import {
  CRATE_POI_TYPE_ID,
  crateBoxDisplayScale,
  CRATE_BOX_COLS,
  CRATE_BOX_FRAME_COUNT,
  CRATE_BOX_FRAME_H,
  CRATE_BOX_FRAME_W,
  CRATE_BOX_ROWS,
  stableCrateRotation,
} from './crateBoxes';
import {
  GERADOR_POI_TYPE_ID,
  geradorDisplayScale,
  GERADOR_COLS,
  GERADOR_FRAME_COUNT,
  GERADOR_FRAME_H,
  GERADOR_FRAME_W,
  GERADOR_ROWS,
  stableGeradorRotation,
} from './geradores';
import {
  COFRE_POI_TYPE_ID,
  cofreDisplayScale,
  COFRE_COLS,
  COFRE_FRAME_COUNT,
  COFRE_FRAME_H,
  COFRE_FRAME_W,
  COFRE_ROWS,
  stableCofreRotation,
} from './cofres';
import {
  MACHINE_POI_TYPE_ID,
  machineDisplayScale,
  MACHINE_COLS,
  MACHINE_FRAME_COUNT,
  MACHINE_FRAME_H,
  MACHINE_FRAME_W,
  MACHINE_ROWS,
  stableMachineRotation,
} from './maquinas';
import {
  LIXEIRA_POI_TYPE_ID,
  lixeiraDisplayScale,
  LIXEIRA_COLS,
  LIXEIRA_FRAME_COUNT,
  LIXEIRA_FRAME_H,
  LIXEIRA_FRAME_W,
  LIXEIRA_ROWS,
  stableLixeiraRotation,
} from './lixeiras';
import {
  MALAS_POI_TYPE_ID,
  malasDisplayScale,
  MALAS_COLS,
  MALAS_FRAME_COUNT,
  MALAS_FRAME_H,
  MALAS_FRAME_W,
  MALAS_ROWS,
  stableMalasRotation,
} from './malas';
import {
  CORPSE_POI_TYPE_ID,
  corpseDisplayScale,
  PESSOAS_MORTAS_COLS,
  PESSOAS_MORTAS_FRAME_COUNT,
  PESSOAS_MORTAS_FRAME_H,
  PESSOAS_MORTAS_FRAME_W,
  PESSOAS_MORTAS_ROWS,
  stableCorpseRotation,
} from './pessoasMortas';
import {
  stableCarRotation,
  WRECKED_CAR_COLS,
  WRECKED_CAR_FRAME_COUNT,
  WRECKED_CAR_FRAME_H,
  WRECKED_CAR_FRAME_W,
  WRECKED_CAR_ROWS,
  wreckedCarDisplayScale,
} from './wreckedCars';

export interface PoiSpriteTuningEntry {
  typeId: string;
  label: string;
  sheetUrl: string;
  cols: number;
  rows: number;
  frameW: number;
  frameH: number;
  frameCount: number;
  previewScale: number;
  baseRotation: (seed: string) => number;
}

const PREVIEW_SCALE_MULT = 2.4;

export const POI_SPRITE_TUNING_CATALOG: readonly PoiSpriteTuningEntry[] = [
  {
    typeId: 'abandoned_car',
    label: 'Carro abandonado',
    sheetUrl: 'assets/props/wrecked_cars_sheet.png?v=7',
    cols: WRECKED_CAR_COLS,
    rows: WRECKED_CAR_ROWS,
    frameW: WRECKED_CAR_FRAME_W,
    frameH: WRECKED_CAR_FRAME_H,
    frameCount: WRECKED_CAR_FRAME_COUNT,
    previewScale: wreckedCarDisplayScale(TILE_SIZE) * PREVIEW_SCALE_MULT,
    baseRotation: (seed) => stableCarRotation(seed),
  },
  {
    typeId: CRATE_POI_TYPE_ID,
    label: 'Caixa',
    sheetUrl: 'assets/props/crate_boxes_sheet.png?v=4',
    cols: CRATE_BOX_COLS,
    rows: CRATE_BOX_ROWS,
    frameW: CRATE_BOX_FRAME_W,
    frameH: CRATE_BOX_FRAME_H,
    frameCount: CRATE_BOX_FRAME_COUNT,
    previewScale: crateBoxDisplayScale(TILE_SIZE) * PREVIEW_SCALE_MULT,
    baseRotation: stableCrateRotation,
  },
  {
    typeId: BACKPACK_POI_TYPE_ID,
    label: 'Mochila',
    sheetUrl: 'assets/props/backpacks_sheet.png?v=4',
    cols: BACKPACK_COLS,
    rows: BACKPACK_ROWS,
    frameW: BACKPACK_FRAME_W,
    frameH: BACKPACK_FRAME_H,
    frameCount: BACKPACK_FRAME_COUNT,
    previewScale: backpackDisplayScale(TILE_SIZE) * PREVIEW_SCALE_MULT,
    baseRotation: stableBackpackRotation,
  },
  {
    typeId: CONTAINER_POI_TYPE_ID,
    label: 'Contêiner',
    sheetUrl: 'assets/props/containers_sheet.png?v=4',
    cols: CONTAINER_COLS,
    rows: CONTAINER_ROWS,
    frameW: CONTAINER_FRAME_W,
    frameH: CONTAINER_FRAME_H,
    frameCount: CONTAINER_FRAME_COUNT,
    previewScale: containerDisplayScale(TILE_SIZE) * PREVIEW_SCALE_MULT,
    baseRotation: stableContainerRotation,
  },
  {
    typeId: MALAS_POI_TYPE_ID,
    label: 'Malas',
    sheetUrl: 'assets/props/malas_sheet.png?v=4',
    cols: MALAS_COLS,
    rows: MALAS_ROWS,
    frameW: MALAS_FRAME_W,
    frameH: MALAS_FRAME_H,
    frameCount: MALAS_FRAME_COUNT,
    previewScale: malasDisplayScale(TILE_SIZE) * PREVIEW_SCALE_MULT,
    baseRotation: stableMalasRotation,
  },
  {
    typeId: LIXEIRA_POI_TYPE_ID,
    label: 'Lixeira',
    sheetUrl: 'assets/props/lixeira_sheet.png?v=4',
    cols: LIXEIRA_COLS,
    rows: LIXEIRA_ROWS,
    frameW: LIXEIRA_FRAME_W,
    frameH: LIXEIRA_FRAME_H,
    frameCount: LIXEIRA_FRAME_COUNT,
    previewScale: lixeiraDisplayScale(TILE_SIZE) * PREVIEW_SCALE_MULT,
    baseRotation: stableLixeiraRotation,
  },
  {
    typeId: GERADOR_POI_TYPE_ID,
    label: 'Gerador',
    sheetUrl: 'assets/props/geradores_sheet.png?v=4',
    cols: GERADOR_COLS,
    rows: GERADOR_ROWS,
    frameW: GERADOR_FRAME_W,
    frameH: GERADOR_FRAME_H,
    frameCount: GERADOR_FRAME_COUNT,
    previewScale: geradorDisplayScale(TILE_SIZE) * PREVIEW_SCALE_MULT,
    baseRotation: stableGeradorRotation,
  },
  {
    typeId: COFRE_POI_TYPE_ID,
    label: 'Cofre',
    sheetUrl: 'assets/props/cofre_sheet.png?v=1',
    cols: COFRE_COLS,
    rows: COFRE_ROWS,
    frameW: COFRE_FRAME_W,
    frameH: COFRE_FRAME_H,
    frameCount: COFRE_FRAME_COUNT,
    previewScale: cofreDisplayScale(TILE_SIZE) * PREVIEW_SCALE_MULT,
    baseRotation: stableCofreRotation,
  },
  {
    typeId: MACHINE_POI_TYPE_ID,
    label: 'Máquina',
    sheetUrl: 'assets/props/machine_sheet.png?v=1',
    cols: MACHINE_COLS,
    rows: MACHINE_ROWS,
    frameW: MACHINE_FRAME_W,
    frameH: MACHINE_FRAME_H,
    frameCount: MACHINE_FRAME_COUNT,
    previewScale: machineDisplayScale(TILE_SIZE) * PREVIEW_SCALE_MULT,
    baseRotation: stableMachineRotation,
  },
  {
    typeId: CORPSE_POI_TYPE_ID,
    label: 'Cadáver',
    sheetUrl: 'assets/props/pessoas_mortas_sheet.png?v=4',
    cols: PESSOAS_MORTAS_COLS,
    rows: PESSOAS_MORTAS_ROWS,
    frameW: PESSOAS_MORTAS_FRAME_W,
    frameH: PESSOAS_MORTAS_FRAME_H,
    frameCount: PESSOAS_MORTAS_FRAME_COUNT,
    previewScale: corpseDisplayScale(TILE_SIZE) * PREVIEW_SCALE_MULT,
    baseRotation: stableCorpseRotation,
  },
];

export const POI_TUNING_PREVIEW_SEED = 'poi-rotation-tuning-preview';

export function getPoiTuningEntry(typeId: string): PoiSpriteTuningEntry | undefined {
  return POI_SPRITE_TUNING_CATALOG.find((e) => e.typeId === typeId);
}
