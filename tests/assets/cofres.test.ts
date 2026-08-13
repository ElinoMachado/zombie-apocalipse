import { describe, expect, it } from 'vitest';
import {
  COFRE_FRAME_COUNT,
  pickCofreFrame,
  stableCofreRotation,
} from '../../src/assets/cofres';

describe('cofres', () => {
  it('picks stable frames in range', () => {
    for (let i = 0; i < 32; i += 1) {
      const frame = pickCofreFrame(`poi-${i}`);
      expect(frame).toBeGreaterThanOrEqual(0);
      expect(frame).toBeLessThan(COFRE_FRAME_COUNT);
    }
    expect(pickCofreFrame('same')).toBe(pickCofreFrame('same'));
    expect(stableCofreRotation('same')).toBe(stableCofreRotation('same'));
  });
});
