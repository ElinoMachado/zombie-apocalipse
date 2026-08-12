import { describe, expect, it } from 'vitest';
import { WorldCollision, rayAabbDistance } from '../../src/game/WorldCollision';

describe('line of sight / raycast', () => {
  it('ray hits aabb in front of origin', () => {
    const t = rayAabbDistance(0, 0, 1, 0, 50, -10, 70, 10);
    expect(t).not.toBeNull();
    expect(t!).toBeCloseTo(50);
  });

  it('blocks line of sight through a wall', () => {
    const col = new WorldCollision();
    col.loadSolids([{ x: 40, y: -15, w: 20, h: 30 }]);
    expect(col.hasLineOfSight(0, 0, 100, 0)).toBe(false);
    expect(col.hasLineOfSight(0, 0, 30, 0)).toBe(true);
  });

  it('raycast shortens cone at obstacle', () => {
    const col = new WorldCollision();
    col.loadSolids([{ x: 30, y: -20, w: 10, h: 40 }]);
    const hit = col.raycastDistance(0, 0, 1, 0, 120);
    expect(hit).toBeCloseTo(30, 0);
  });

  it('clear path returns max distance', () => {
    const col = new WorldCollision();
    col.loadSolids([{ x: 200, y: 0, w: 10, h: 10 }]);
    expect(col.raycastDistance(0, 0, 1, 0, 80)).toBe(80);
    expect(col.hasLineOfSight(0, 0, 60, 0)).toBe(true);
  });
});
