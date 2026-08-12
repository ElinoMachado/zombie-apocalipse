import { describe, expect, it } from 'vitest';
import {
  BACKPEDAL_SPEED_MULT,
  backpedalSpeedFactor,
  isMovingBackwards,
  PLAYER_SPRINT_SPEED,
  PLAYER_WALK_SPEED,
  SPRINT_SPEED_MULT,
  ZOMBIE_REF_CHASE_SPEED,
} from '../../src/game/playerStats';

describe('player speed balance', () => {
  it('walk is 5% slower than reference zombie chase', () => {
    expect(PLAYER_WALK_SPEED).toBeCloseTo(ZOMBIE_REF_CHASE_SPEED * 0.95);
  });

  it('sprint is 30% faster than reference zombie chase', () => {
    expect(PLAYER_SPRINT_SPEED).toBeCloseTo(ZOMBIE_REF_CHASE_SPEED * 1.3);
    expect(PLAYER_WALK_SPEED * SPRINT_SPEED_MULT).toBeCloseTo(
      PLAYER_SPRINT_SPEED,
    );
  });

  it('backpedal halves only when fully opposite; blends near 90°', () => {
    expect(BACKPEDAL_SPEED_MULT).toBe(0.5);
    expect(isMovingBackwards(-1, 0, 0)).toBe(true);
    expect(isMovingBackwards(1, 0, 0)).toBe(false);
    expect(backpedalSpeedFactor(1, 0, 0)).toBe(1);
    expect(backpedalSpeedFactor(0, -1, 0)).toBe(1);
    expect(backpedalSpeedFactor(-1, 0, 0)).toBeCloseTo(0.5);
    expect(backpedalSpeedFactor(-0.5, 0, 0)).toBeCloseTo(0.75);
  });
});
