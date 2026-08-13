import path from 'node:path';
import { buildPropSheet, buildPropSheetByBands, type PropSheetConfig } from './buildPropSheet';

const propsDir = path.join(process.cwd(), 'public/assets/props');

const SHEETS: PropSheetConfig[] = [
  {
    source: 'backpacks_source.png',
    outSheet: 'backpacks_sheet.png',
    outMeta: 'backpacks_sheet.meta.json',
    cols: 4,
    rows: 2,
  },
  {
    source: 'crate_boxes_source.png',
    outSheet: 'crate_boxes_sheet.png',
    outMeta: 'crate_boxes_sheet.meta.json',
    cols: 4,
    rows: 2,
  },
  {
    source: 'malas_source.png',
    outSheet: 'malas_sheet.png',
    outMeta: 'malas_sheet.meta.json',
    cols: 4,
    rows: 2,
  },
  {
    source: 'containers_source.png',
    outSheet: 'containers_sheet.png',
    outMeta: 'containers_sheet.meta.json',
    cols: 2,
    rows: 4,
  },
  {
    source: 'lixeira_source.png',
    outSheet: 'lixeira_sheet.png',
    outMeta: 'lixeira_sheet.meta.json',
    cols: 4,
    rows: 2,
  },
  {
    source: 'geradores_source.png',
    outSheet: 'geradores_sheet.png',
    outMeta: 'geradores_sheet.meta.json',
    cols: 3,
    rows: 3,
  },
  {
    source: 'pessoas-mortas_source.png',
    outSheet: 'pessoas_mortas_sheet.png',
    outMeta: 'pessoas_mortas_sheet.meta.json',
    cols: 4,
    rows: 2,
  },
  {
    source: 'cofre_source.png',
    outSheet: 'cofre_sheet.png',
    outMeta: 'cofre_sheet.meta.json',
    cols: 4,
    rows: 2,
  },
  {
    source: 'machine_source.png',
    outSheet: 'machine_sheet.png',
    outMeta: 'machine_sheet.meta.json',
    cols: 4,
    rows: 2,
  },
  {
    source: 'wrecked_cars_source.png',
    outSheet: 'wrecked_cars_sheet.png',
    outMeta: 'wrecked_cars_sheet.meta.json',
    cols: 14,
    rows: 3,
  },
];

for (const cfg of SHEETS) {
  const build =
    cfg.source === 'wrecked_cars_source.png' ? buildPropSheetByBands : buildPropSheet;
  const meta = build(propsDir, cfg);
  console.log(
    `${cfg.outSheet} ${meta.sheetWidth}x${meta.sheetHeight} frame ${meta.frameWidth}x${meta.frameHeight} (${meta.cols}x${meta.rows})`,
  );
}
