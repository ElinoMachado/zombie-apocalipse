import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CityTarget } from '../cities';
import type { BlockMetrics } from './blocks';
import type { BuildingMetrics } from './buildings';
import type { PoiMetrics } from './pois';
import type { RoadMetrics } from './roads';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPORTS_DIR = path.resolve(
  __dirname,
  '../../../../profiles/raw-metrics',
);

export interface CityMetricsReport {
  cityId: string;
  label: string;
  generatedAt: string;
  bbox: CityTarget['bbox'];
  source: {
    overpassCached: boolean;
    cachePath: string;
    elementCount: number;
  };
  layers: {
    roads: number;
    buildings: number;
    amenities: number;
    shops: number;
    landuse: number;
  };
  roads: RoadMetrics;
  /** Present after phase-8 block extractor; optional for older metric dumps. */
  blocks?: BlockMetrics;
  buildings: BuildingMetrics;
  pois: PoiMetrics;
  insufficientSummary: string[];
}

export function collectInsufficient(report: CityMetricsReport): string[] {
  const flags: string[] = [];
  if (report.roads.meta.quality === 'insufficient') flags.push('roads');
  for (const n of report.roads.meta.notes) {
    if (n.includes('INSUFFICIENT')) flags.push(`roads:${n}`);
  }
  if (!report.blocks || report.blocks.meta.quality === 'insufficient') {
    flags.push('blocks');
  }
  if (report.buildings.meta.quality === 'insufficient') flags.push('buildings');
  if (report.buildings.lots.quality === 'insufficient') flags.push('lots');
  for (const [id, g] of Object.entries(report.pois.groups)) {
    if (g.quality === 'insufficient') flags.push(`poi.${id}`);
  }
  return [...new Set(flags)];
}

export function writeReport(report: CityMetricsReport): string {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const out = path.join(REPORTS_DIR, `${report.cityId}.metrics.json`);
  report.insufficientSummary = collectInsufficient(report);
  fs.writeFileSync(out, JSON.stringify(report, null, 2), 'utf8');
  return out;
}

export function formatReportMarkdown(report: CityMetricsReport): string {
  const flags = collectInsufficient(report);
  const lines = [
    `# ${report.label}`,
    '',
    `- cityId: \`${report.cityId}\``,
    `- generatedAt: ${report.generatedAt}`,
    `- elements OSM: ${report.source.elementCount}`,
    `- cache: ${report.source.overpassCached ? 'hit' : 'fetched'}`,
    '',
    '## Layers',
    `- roads: ${report.layers.roads}`,
    `- buildings: ${report.layers.buildings}`,
    `- amenities: ${report.layers.amenities}`,
    `- shops: ${report.layers.shops}`,
    `- landuse: ${report.layers.landuse}`,
    '',
    '## Roads',
    `- quality: ${report.roads.meta.quality} (confidence ${report.roads.meta.confidence.toFixed(2)})`,
    `- count: ${report.roads.count}`,
    `- totalLengthKm: ${report.roads.totalLengthKm.toFixed(1)}`,
    `- regularityIndex: ${report.roads.regularityIndex.toFixed(3)}`,
    `- graph nodes/edges: ${report.roads.graph.nodeCount}/${report.roads.graph.edgeCount}`,
    `- meanDegree: ${report.roads.graph.meanDegree.toFixed(2)}`,
    `- deadEndRatio: ${report.roads.graph.deadEndRatio.toFixed(3)}`,
    `- segmentLengthM p50: ${report.roads.segmentLengthM.p50.toFixed(1)}`,
    '',
    '## Blocks',
    report.blocks
      ? `- quality: ${report.blocks.meta.quality} (n=${report.blocks.meta.sampleSize}, conf ${report.blocks.meta.confidence.toFixed(2)})`
      : '- quality: missing',
    report.blocks
      ? `- faceLengthM p50: ${report.blocks.faceLengthM.p50.toFixed(1)}`
      : '- faceLengthM: n/a',
    report.blocks
      ? `- areaM2 p50: ${report.blocks.areaM2.p50.toFixed(0)}`
      : '- areaM2: n/a',
    report.blocks
      ? `- aspectRatio p50: ${report.blocks.aspectRatio.p50.toFixed(2)}`
      : '- aspectRatio: n/a',
    '',
    '## Buildings',
    `- quality: ${report.buildings.meta.quality}`,
    `- polygons: ${report.buildings.meta.polygonCount}`,
    `- areaM2 p50: ${report.buildings.areaM2.p50.toFixed(1)}`,
    `- lots: ${report.buildings.lots.notes}`,
    '',
    '## POIs (counts)',
  ];

  for (const [id, g] of Object.entries(report.pois.groups)) {
    const dist =
      g.distanceToNearestMajorRoadM != null
        ? ` | roadDist p50=${g.distanceToNearestMajorRoadM.p50.toFixed(0)}m`
        : '';
    lines.push(`- ${id}: n=${g.count} (${g.quality})${dist}`);
  }

  lines.push('', '## INSUFFICIENT DATA flags', '');
  if (flags.length === 0) lines.push('- (none)');
  else for (const f of flags) lines.push(`- ${f}`);

  return lines.join('\n');
}
