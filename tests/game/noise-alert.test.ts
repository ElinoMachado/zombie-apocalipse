import { describe, expect, it } from 'vitest';
import {
  interpretNoiseRoll,
  roll4d4,
  rollNoiseAlert,
} from '../../src/game/combat/noiseAlert';

describe('noiseAlert 4d4', () => {
  it('rolls four dice between 1 and 4', () => {
    const dice = roll4d4(() => 0);
    expect(dice).toEqual([1, 1, 1, 1]);
    const maxed = roll4d4(() => 0.99);
    expect(maxed).toEqual([4, 4, 4, 4]);
  });

  it('attracts nearest zombie when any die is max but not all', () => {
    const r = interpretNoiseRoll([4, 2, 4, 1]);
    expect(r.maxHits).toBe(2);
    expect(r.noiseHeard).toBe(true);
    expect(r.elite).toBe(false);
  });

  it('spawns elite when all four are max', () => {
    const r = interpretNoiseRoll([4, 4, 4, 4]);
    expect(r.elite).toBe(true);
    expect(r.noiseHeard).toBe(false);
  });

  it('is silent when no die is max', () => {
    const r = interpretNoiseRoll([1, 2, 3, 2]);
    expect(r.maxHits).toBe(0);
    expect(r.noiseHeard).toBe(false);
    expect(r.elite).toBe(false);
  });

  it('rollNoiseAlert returns consistent shape', () => {
    const r = rollNoiseAlert(() => 0.5);
    expect(r.dice).toHaveLength(4);
    expect(r.maxHits + (4 - r.maxHits)).toBe(4);
  });
});
