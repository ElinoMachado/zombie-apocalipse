import type { City, Density, RoadType } from '../model/types';
import type { CityProfile } from '../profiles/types';

export interface ProfileFitReport {
  profileId: string;
  /** Soft: true se desvios estão dentro de tolerâncias grosseiras. */
  ok: boolean;
  notes: string[];
  emptyLotRate: number;
  emptyLotExpected: number;
  meanLotArea: number;
  expectedMeanLotArea: number;
  hierarchyL1: number;
  roadShare: Partial<Record<RoadType, number>>;
  weightShare: Partial<Record<RoadType, number>>;
}

const ROAD_TYPES: RoadType[] = [
  'highway',
  'main',
  'avenue',
  'street',
  'residential',
];

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/**
 * Compara estatísticas grosseiras da cidade gerada com o CityProfile.
 * Não é teste de hipótese formal — guia de calibração / dump.
 */
export function compareCityToProfile(
  city: City,
  profile: CityProfile,
): ProfileFitReport {
  const notes: string[] = [];

  const emptyN = city.lots.filter((l) => l.structureIds.length === 0).length;
  const emptyLotRate = city.lots.length ? emptyN / city.lots.length : 0;
  let emptyLotExpected = 0;
  if (city.lots.length) {
    for (const lot of city.lots) {
      emptyLotExpected +=
        profile.lots.emptyLotChanceByDensity[lot.density as Density] ?? 0.2;
    }
    emptyLotExpected /= city.lots.length;
  }

  const meanLotArea = mean(city.lots.map((l) => l.size));
  let expectedMeanLotArea = 0;
  if (city.lots.length) {
    for (const lot of city.lots) {
      expectedMeanLotArea +=
        profile.lots.areaByDensity[lot.density as Density]?.p50 ?? lot.size;
    }
    expectedMeanLotArea /= city.lots.length;
  }

  const roadCount: Partial<Record<RoadType, number>> = {};
  for (const seg of city.roads) {
    roadCount[seg.type] = (roadCount[seg.type] ?? 0) + 1;
  }
  const roadTotal = city.roads.length || 1;
  const roadShare: Partial<Record<RoadType, number>> = {};
  for (const t of ROAD_TYPES) {
    roadShare[t] = (roadCount[t] ?? 0) / roadTotal;
  }

  const rawW = profile.roadNetwork.hierarchyWeights;
  let wSum = 0;
  for (const t of ROAD_TYPES) wSum += rawW[t] ?? 0;
  if (wSum <= 0) wSum = 1;
  const weightShare: Partial<Record<RoadType, number>> = {};
  for (const t of ROAD_TYPES) {
    weightShare[t] = (rawW[t] ?? 0) / wSum;
  }

  let hierarchyL1 = 0;
  for (const t of ROAD_TYPES) {
    hierarchyL1 += Math.abs((roadShare[t] ?? 0) - (weightShare[t] ?? 0));
  }

  if (Math.abs(emptyLotRate - emptyLotExpected) > 0.18) {
    notes.push(
      `emptyLotRate ${(emptyLotRate * 100).toFixed(0)}% vs esperado ~${(emptyLotExpected * 100).toFixed(0)}%`,
    );
  }
  if (
    expectedMeanLotArea > 0 &&
    Math.abs(meanLotArea - expectedMeanLotArea) / expectedMeanLotArea > 0.35
  ) {
    notes.push(
      `meanLotArea ${meanLotArea.toFixed(0)} vs esperado ~${expectedMeanLotArea.toFixed(0)}`,
    );
  }
  if (hierarchyL1 > 0.85) {
    notes.push(
      `hierarquia viária L1=${hierarchyL1.toFixed(2)} (pesos do profile pouco reflectidos)`,
    );
  }

  for (const flag of profile.insufficient) {
    if (flag.key.includes('lots') || flag.key.includes('blocks')) {
      notes.push(`profile flag: ${flag.reason}`);
    }
  }

  return {
    profileId: profile.id,
    ok: notes.filter((n) => !n.startsWith('profile flag:')).length === 0,
    notes,
    emptyLotRate,
    emptyLotExpected,
    meanLotArea,
    expectedMeanLotArea,
    hierarchyL1,
    roadShare,
    weightShare,
  };
}

export function formatProfileFit(report: ProfileFitReport): string {
  const lines = [
    `Fit vs ${report.profileId}: ${report.ok ? 'ok' : 'desvios'}`,
    `  emptyLots ${(report.emptyLotRate * 100).toFixed(0)}% (esp ~${(report.emptyLotExpected * 100).toFixed(0)}%)`,
    `  meanLotArea ${report.meanLotArea.toFixed(0)} (esp ~${report.expectedMeanLotArea.toFixed(0)})`,
    `  hierarchy L1 ${report.hierarchyL1.toFixed(2)}`,
  ];
  for (const n of report.notes) {
    if (!n.startsWith('profile flag:')) lines.push(`  ! ${n}`);
  }
  return lines.join('\n');
}
