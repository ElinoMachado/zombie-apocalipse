import { describe, expect, it } from 'vitest';
import {
  stableBackpackNaturalRotation,
  stableContainerNaturalRotation,
  stableGroundLyingRotation,
  stableUprightRotation,
  UPRIGHT_CARDINALS,
} from '../../src/assets/poiCardinalRotation';

const QUARTER = Math.PI / 2;
const CARDINAL = [0, QUARTER, Math.PI, 3 * QUARTER];
const NO_UPSIDE_DOWN = [0, QUARTER, 3 * QUARTER];

function isMultipleOf(value: number, step: number, eps = 1e-9): boolean {
  const ratio = value / step;
  return Math.abs(ratio - Math.round(ratio)) < eps;
}

function isNear(a: number, b: number, eps = 1e-9): boolean {
  return Math.abs(a - b) < eps;
}

describe('poiCardinalRotation', () => {
  it('upright rotation never flips sprite upside down (no π)', () => {
    for (let i = 0; i < 60; i += 1) {
      const rot = stableUprightRotation(`seed-${i}`);
      expect(NO_UPSIDE_DOWN.some((a) => isNear(rot, a))).toBe(true);
      expect(isNear(rot, Math.PI)).toBe(false);
    }
  });

  it('backpack rotation strongly prefers default (0)', () => {
    let zeros = 0;
    for (let i = 0; i < 100; i += 1) {
      const rot = stableBackpackNaturalRotation(`poi-${i}`);
      expect(UPRIGHT_CARDINALS.some((a) => isNear(rot, a))).toBe(true);
      if (isNear(rot, 0)) zeros += 1;
    }
    expect(zeros).toBeGreaterThan(50);
  });

  it('container rotation stays flat without flip', () => {
    for (let i = 0; i < 40; i += 1) {
      const rot = stableContainerNaturalRotation(`seed-${i}`);
      expect([0, QUARTER].some((a) => isNear(rot, a))).toBe(true);
      expect(isNear(rot, Math.PI)).toBe(false);
    }
  });

  it('ground lying rotation uses cardinals only', () => {
    for (let i = 0; i < 40; i += 1) {
      const rot = stableGroundLyingRotation(`seed-${i}`);
      expect(CARDINAL.some((a) => isNear(rot, a))).toBe(true);
      expect(isMultipleOf(rot, QUARTER)).toBe(true);
    }
  });
});

describe('prop POI rotations', () => {
  it('crate, backpack, malas and container use fixed upright (0°) like trash bins', async () => {
    const { stableCrateRotation } = await import('../../src/assets/crateBoxes');
    const { stableBackpackRotation } = await import('../../src/assets/backpacks');
    const { stableMalasRotation } = await import('../../src/assets/malas');
    const { stableContainerRotation } = await import('../../src/assets/containers');
    const { stableLixeiraRotation } = await import('../../src/assets/lixeiras');
    for (const fn of [
      stableCrateRotation,
      stableBackpackRotation,
      stableMalasRotation,
      stableContainerRotation,
      stableLixeiraRotation,
    ]) {
      for (let i = 0; i < 24; i += 1) {
        expect(fn(`poi-${i}`)).toBe(0);
      }
    }
  });
});
