import { describe, expect, it } from 'vitest';
import { EnemyNavGrid } from '../../src/game/combat/EnemyNavGrid';
import { WorldCollision } from '../../src/game/WorldCollision';

describe('EnemyNavGrid', () => {
  it('finds a path around a solid wall with vertical gaps', () => {
    const col = new WorldCollision();
    col.loadSolids([
      { x: 90, y: 40, w: 20, h: 120 },
    ]);
    const nav = EnemyNavGrid.build(col, 200, 200, 20, 8);

    const path = nav.findPath(20, 100, 180, 100);
    expect(path).not.toBeNull();
    expect(path!.length).toBeGreaterThan(0);

    for (const p of path!) {
      expect(col.hits({ x: p.x, y: p.y, radius: 8 })).toBe(false);
    }
  });

  it('returns null when start and goal are separated by a full barrier', () => {
    const col = new WorldCollision();
    col.loadSolids([
      { x: 90, y: 0, w: 20, h: 200 },
    ]);
    const nav = EnemyNavGrid.build(col, 200, 200, 20, 8);
    expect(nav.findPath(20, 100, 180, 100)).toBeNull();
  });

  it('targets the nearest walkable cell to the player when goal sits inside solids', () => {
    const col = new WorldCollision();
    col.loadSolids([
      { x: 60, y: 60, w: 80, h: 80 },
    ]);
    const nav = EnemyNavGrid.build(col, 200, 200, 20, 8);
    const path = nav.findPath(20, 20, 100, 100);
    expect(path).not.toBeNull();
    const last = path![path!.length - 1]!;
    expect(col.hits({ x: last.x, y: last.y, radius: 8 })).toBe(false);
    expect(Math.hypot(last.x - 100, last.y - 100)).toBeGreaterThan(8);
  });

  it('paths around a car toward the player side of the obstacle', () => {
    const col = new WorldCollision();
    col.loadSolids([{ x: 88, y: 40, w: 24, h: 120 }]);
    const nav = EnemyNavGrid.build(col, 200, 200, 20, 8);
    const playerX = 120;
    const playerY = 100;
    const path = nav.findPath(40, 100, playerX, playerY);
    expect(path).not.toBeNull();
    const last = path![path!.length - 1]!;
    expect(last.x).toBeGreaterThan(100);
    expect(Math.hypot(last.x - playerX, last.y - playerY)).toBeLessThan(30);
  });
});
