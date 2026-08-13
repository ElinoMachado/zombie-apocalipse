import { describe, expect, it } from 'vitest';
import type { City } from '../../src/world/model/types';
import {
  buildPoiPlacementContext,
  computeRoadDistanceGrid,
  isSidewalkInnerEdgeTile,
  satisfiesPoiPlacement,
  trashBinInnerEdgeOffsetTiles,
} from '../../src/world/pipeline/poiPlacementRules';

function miniCity(partial: Partial<City> & Pick<City, 'grid'>): City {
  const { w, h } = partial.grid;
  const n = w * h;
  return {
    tileSize: 32,
    center: { x: w / 2, y: h / 2 },
    zoneGrid: Array(n).fill('mixed'),
    roadGrid: Array(n).fill(null),
    sidewalkGrid: Array(n).fill(false),
    lots: [],
    structures: [],
    explorationPoints: [],
    ambientProps: [],
    ...partial,
  } as City;
}

describe('poiPlacementRules', () => {
  it('lixeira na borda interior da calçada', () => {
    const city = miniCity({ grid: { w: 5, h: 5 } });
    // Via em y=0; calçada em (2,1); lote em (2,2)
    city.roadGrid[2] = 'street';
    city.sidewalkGrid[7] = true;
    const ctx = buildPoiPlacementContext(city);
    const relax = { skipHardRules: false };

    expect(
      satisfiesPoiPlacement(city, 2, 1, 'mixed', 'trash_bin', ctx, relax),
    ).toBe(true);

    const off = trashBinInnerEdgeOffsetTiles(city, 2, 1);
    expect(off.oy).toBeGreaterThan(0);

    // Fila exterior de calçada dupla: vizinho de calçada mais interior
    city.sidewalkGrid[6] = true;
    city.sidewalkGrid[11] = true;
    city.roadGrid[1] = 'street';
    const edgeCtx = buildPoiPlacementContext(city);
    expect(
      satisfiesPoiPlacement(city, 1, 1, 'mixed', 'trash_bin', edgeCtx, relax),
    ).toBe(false);
    expect(
      satisfiesPoiPlacement(city, 1, 2, 'mixed', 'trash_bin', edgeCtx, relax),
    ).toBe(true);
    expect(
      satisfiesPoiPlacement(city, 0, 0, 'mixed', 'trash_bin', ctx, relax),
    ).toBe(false);
    expect(
      satisfiesPoiPlacement(city, 0, 0, 'mixed', 'crate', ctx, relax),
    ).toBe(false);
  });

  it('borda interior usa a última fila quando a calçada tem profundidade > 1', () => {
    const city = miniCity({ grid: { w: 6, h: 4 } });
    for (let x = 0; x < 6; x += 1) {
      city.roadGrid[x] = 'street';
    }
    city.sidewalkGrid[6] = true;
    city.sidewalkGrid[12] = true;
    const dist = computeRoadDistanceGrid(city);
    expect(isSidewalkInnerEdgeTile(city, 0, 1, dist)).toBe(false);
    expect(isSidewalkInnerEdgeTile(city, 0, 2, dist)).toBe(true);
  });

  it('mochila perto de escola', () => {
    const city = miniCity({ grid: { w: 40, h: 40 } });
    city.structures.push({
      id: 's1',
      typeId: 'school',
      category: 'primary',
      lotId: null,
      parentId: null,
      bounds: { x: 20, y: 20, w: 4, h: 4 },
      rooms: [],
      entrances: [],
      metadata: {},
    });
    const ctx = buildPoiPlacementContext(city);
    const relax = { skipHardRules: false };

    expect(
      satisfiesPoiPlacement(city, 24, 22, 'mixed', 'backpack', ctx, relax),
    ).toBe(true);
    expect(
      satisfiesPoiPlacement(city, 2, 2, 'mixed', 'backpack', ctx, relax),
    ).toBe(false);
  });

  it('gerador em contexto industrial', () => {
    const city = miniCity({ grid: { w: 40, h: 40 } });
    city.zoneGrid.fill('industrial');
    const ctx = buildPoiPlacementContext(city);
    const relax = { skipHardRules: false };

    expect(
      satisfiesPoiPlacement(city, 5, 5, 'industrial', 'generator', ctx, relax),
    ).toBe(true);
  });
});
