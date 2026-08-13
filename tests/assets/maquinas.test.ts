import { describe, expect, it } from 'vitest';
import {
  MACHINE_FRAME_COUNT,
  pickMachineFrame,
  stableMachineRotation,
} from '../../src/assets/maquinas';

describe('maquinas', () => {
  it('picks stable frames in range', () => {
    for (let i = 0; i < 32; i += 1) {
      const frame = pickMachineFrame(`poi-${i}`);
      expect(frame).toBeGreaterThanOrEqual(0);
      expect(frame).toBeLessThan(MACHINE_FRAME_COUNT);
    }
    expect(pickMachineFrame('same')).toBe(pickMachineFrame('same'));
    expect(stableMachineRotation('same')).toBe(stableMachineRotation('same'));
  });
});
