import { describe, expect, it } from 'vitest';
import {
  CONTAINER_FRAME_COUNT,
  pickContainerFrame,
  stableContainerRotation,
} from '../../src/assets/containers';

describe('containers', () => {
  it('picks stable frames in range', () => {
    for (let i = 0; i < 32; i += 1) {
      const frame = pickContainerFrame(`poi-${i}`);
      expect(frame).toBeGreaterThanOrEqual(0);
      expect(frame).toBeLessThan(CONTAINER_FRAME_COUNT);
    }
    expect(pickContainerFrame('same')).toBe(pickContainerFrame('same'));
    expect(stableContainerRotation('same')).toBe(stableContainerRotation('same'));
  });
});
