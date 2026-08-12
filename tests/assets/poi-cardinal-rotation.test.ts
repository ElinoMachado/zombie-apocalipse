import { describe, expect, it } from 'vitest';
import {
  stableFlatRotation,
  stableUprightOrFlatRotation,
} from '../../src/assets/poiCardinalRotation';

const QUARTER = Math.PI / 2;
const CARDINAL = [0, QUARTER, Math.PI, 3 * QUARTER];
const FLAT = [0, Math.PI];

function isMultipleOf(value: number, step: number, eps = 1e-9): boolean {
  const ratio = value / step;
  return Math.abs(ratio - Math.round(ratio)) < eps;
}

describe('poiCardinalRotation', () => {
  it('flat rotation is always horizontal (0 or π)', () => {
    for (let i = 0; i < 40; i += 1) {
      const rot = stableFlatRotation(`seed-${i}`);
      expect(FLAT.some((a) => Math.abs(rot - a) < 1e-9)).toBe(true);
    }
  });

  it('upright-or-flat rotation snaps to cardinals only', () => {
    for (let i = 0; i < 40; i += 1) {
      const rot = stableUprightOrFlatRotation(`seed-${i}`);
      expect(CARDINAL.some((a) => Math.abs(rot - a) < 1e-9)).toBe(true);
      expect(isMultipleOf(rot, QUARTER)).toBe(true);
    }
  });
});

describe('prop POI rotations', () => {
  it('containers are always flat', async () => {
    const { stableContainerRotation } = await import('../../src/assets/containers');
    for (let i = 0; i < 20; i += 1) {
      const rot = stableContainerRotation(`poi-${i}`);
      expect(FLAT.some((a) => Math.abs(rot - a) < 1e-9)).toBe(true);
    }
  });

  it('crate, backpack and malas use cardinal rotations', async () => {
    const { stableCrateRotation } = await import('../../src/assets/crateBoxes');
    const { stableBackpackRotation } = await import('../../src/assets/backpacks');
    const { stableMalasRotation } = await import('../../src/assets/malas');
    for (const fn of [
      stableCrateRotation,
      stableBackpackRotation,
      stableMalasRotation,
    ]) {
      for (let i = 0; i < 12; i += 1) {
        const rot = fn(`poi-${i}`);
        expect(CARDINAL.some((a) => Math.abs(rot - a) < 1e-9)).toBe(true);
      }
    }
  });
});
