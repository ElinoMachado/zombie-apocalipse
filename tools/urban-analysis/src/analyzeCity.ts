import { getCityTarget } from './cities';
import { overpassToLayers, type OsmResponse } from './convert';
import { computeBlockMetrics } from './metrics/blocks';
import { computeBuildingMetrics } from './metrics/buildings';
import { computePoiMetrics } from './metrics/pois';
import {
  formatReportMarkdown,
  writeReport,
  type CityMetricsReport,
} from './metrics/report';
import { computeRoadMetrics } from './metrics/roads';
import { fetchOverpass } from './overpass';

export interface AnalyzeOptions {
  cityId: string;
  forceFetch?: boolean;
}

export async function analyzeCity(
  options: AnalyzeOptions,
): Promise<{ report: CityMetricsReport; reportPath: string; markdown: string }> {
  const city = getCityTarget(options.cityId);
  const { data, fromCache, path: cachePath } = await fetchOverpass(city, {
    force: options.forceFetch,
  });

  const layers = overpassToLayers(data as OsmResponse);
  const roads = computeRoadMetrics(layers.roads);
  const blocks = computeBlockMetrics(layers.roads);
  const buildings = computeBuildingMetrics(layers.buildings);
  const pois = computePoiMetrics(layers.amenities, layers.shops, layers.roads);

  const report: CityMetricsReport = {
    cityId: city.id,
    label: city.label,
    generatedAt: new Date().toISOString(),
    bbox: city.bbox,
    source: {
      overpassCached: fromCache,
      cachePath,
      elementCount: layers.elementCount,
    },
    layers: {
      roads: layers.roads.features.length,
      buildings: layers.buildings.features.length,
      amenities: layers.amenities.features.length,
      shops: layers.shops.features.length,
      landuse: layers.landuse.features.length,
    },
    roads,
    blocks,
    buildings,
    pois,
    insufficientSummary: [],
  };

  const reportPath = writeReport(report);
  const markdown = formatReportMarkdown(report);
  return { report, reportPath, markdown };
}
