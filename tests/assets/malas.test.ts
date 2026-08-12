import { describe, expect, it } from 'vitest';
import {
  MALAS_FRAME_COUNT,
  pickMalasFrame,
  stableMalasRotation,
} from '../../src/assets/malas';

describe('malas', () => {
  it('picks stable frames in range', () => {
    for (let i = 0; i < 32; i += 1) {
      const frame = pickMalasFrame(`poi-${i}`);
      expect(frame).toBeGreaterThanOrEqual(0);
      expect(frame).toBeLessThan(MALAS_FRAME_COUNT);
    }
    expect(pickMalasFrame('same')).toBe(pickMalasFrame('same'));
    expect(stableMalasRotation('same')).toBe(stableMalasRotation('same'));
  });
});
