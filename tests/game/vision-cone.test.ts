import { describe, expect, it } from 'vitest';
import {
  angleBetween,
  canDetectInVision,
  inCone,
  isBackstabPosition,
  ZOMBIE_VISION_HALF_ANGLE,
  ZOMBIE_VISION_RANGE_MULT,
} from '../../src/game/combat/visionCone';

describe('zombie vision cone', () => {
  it('is 90 degrees total and 1.5x range mult', () => {
    expect(ZOMBIE_VISION_HALF_ANGLE).toBeCloseTo(Math.PI / 4);
    expect(ZOMBIE_VISION_RANGE_MULT).toBeCloseTo(1.5);
  });

  it('sees targets ahead inside cone', () => {
    expect(inCone(0, 0, 0, 40, 0, 60, ZOMBIE_VISION_HALF_ANGLE)).toBe(true);
    // ~51° > 45° half-angle
    expect(inCone(0, 0, 0, 40, 50, 100, ZOMBIE_VISION_HALF_ANGLE)).toBe(false);
  });

  it('does not see behind', () => {
    expect(inCone(0, 0, 0, -30, 0, 60, ZOMBIE_VISION_HALF_ANGLE)).toBe(false);
  });

  it('detects backstab from rear hemisphere', () => {
    expect(isBackstabPosition(0, 0, 0, -20, 0)).toBe(true);
    expect(isBackstabPosition(0, 0, 0, 20, 0)).toBe(false);
    expect(angleBetween(0, Math.PI)).toBeCloseTo(Math.PI);
  });

  it('stealth only uses the inner half of the cone', () => {
    // Outer half: dist 50, outer range 80 → seen standing, hidden crouched
    expect(canDetectInVision(0, 0, 0, 50, 0, 80, ZOMBIE_VISION_HALF_ANGLE, false)).toBe(
      true,
    );
    expect(canDetectInVision(0, 0, 0, 50, 0, 80, ZOMBIE_VISION_HALF_ANGLE, true)).toBe(
      false,
    );
    // Inner half: dist 30 < 40
    expect(canDetectInVision(0, 0, 0, 30, 0, 80, ZOMBIE_VISION_HALF_ANGLE, true)).toBe(
      true,
    );
  });
});
