import { describe, expect, it } from 'vitest';
import {
  hearingRadius,
  proximityGain,
  PROXIMITY_BASE_RADIUS_PX,
} from '../../src/audio/ProximityAudio';

describe('ProximityAudio falloff', () => {
  it('scales hearing radius with loudness', () => {
    expect(hearingRadius(1)).toBe(PROXIMITY_BASE_RADIUS_PX);
    expect(hearingRadius(0.5)).toBe(PROXIMITY_BASE_RADIUS_PX * 0.5);
  });

  it('is full loudness at source and silent at radius', () => {
    const loud = 0.8;
    expect(proximityGain(0, loud)).toBeCloseTo(loud);
    expect(proximityGain(hearingRadius(loud), loud)).toBe(0);
    expect(proximityGain(hearingRadius(loud) + 10, loud)).toBe(0);
  });

  it('is quieter farther away', () => {
    const loud = 1;
    const near = proximityGain(40, loud);
    const far = proximityGain(200, loud);
    expect(near).toBeGreaterThan(far);
    expect(far).toBeGreaterThan(0);
  });
});
