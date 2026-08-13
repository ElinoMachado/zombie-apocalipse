import { describe, expect, it } from 'vitest';
import { SpawnSpacingGrid } from '../../src/game/combat/spawnSpacingGrid';

describe('SpawnSpacingGrid', () => {
  it('rejects points closer than minSep', () => {
    const grid = new SpawnSpacingGrid(16);
    grid.add(100, 100);
    expect(grid.tooClose(108, 100, 12)).toBe(true);
    expect(grid.tooClose(130, 100, 12)).toBe(false);
  });
});
