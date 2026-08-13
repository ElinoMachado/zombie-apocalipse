import { describe, expect, it } from 'vitest';
import { WorldCollision } from '../../src/game/WorldCollision';

describe('WorldCollision tryMove', () => {
  it('slides past an L-corner when one axis order fails', () => {
    const col = new WorldCollision();
    col.loadSolids([
      { x: 96, y: 40, w: 24, h: 80 },
      { x: 72, y: 96, w: 48, h: 24 },
    ]);

    const r = 8;
    const startX = 80;
    const startY = 80;
    const dx = 12;
    const dy = -12;

    const moved = col.tryMove(startX, startY, dx, dy, r, 200, 200);
    expect(moved.moved).toBeGreaterThan(0);
    expect(col.hits({ x: moved.x, y: moved.y, radius: r })).toBe(false);
  });
});
