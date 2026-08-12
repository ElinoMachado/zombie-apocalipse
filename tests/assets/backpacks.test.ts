import { describe, expect, it } from 'vitest';
import {
  BACKPACK_FRAME_COUNT,
  pickBackpackFrame,
  stableBackpackRotation,
} from '../../src/assets/backpacks';

describe('backpacks', () => {
  it('picks stable frames in range', () => {
    for (let i = 0; i < 32; i += 1) {
      const frame = pickBackpackFrame(`poi-${i}`);
      expect(frame).toBeGreaterThanOrEqual(0);
      expect(frame).toBeLessThan(BACKPACK_FRAME_COUNT);
    }
    expect(pickBackpackFrame('same')).toBe(pickBackpackFrame('same'));
    expect(stableBackpackRotation('same')).toBe(stableBackpackRotation('same'));
  });
});
