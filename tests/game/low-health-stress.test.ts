import { describe, expect, it } from 'vitest';
import {
  HEARTBEAT_ATTACKED_SEC,
  HEARTBEAT_TIER_SEC,
  hpRatio,
  lowHealthStress,
  pickHeartbeatTier,
} from '../../src/game/lowHealthStress';

describe('lowHealthStress', () => {
  it('maps hp ratio to stress above 75%', () => {
    expect(lowHealthStress(1)).toBe(0);
    expect(lowHealthStress(0.76)).toBe(0);
    expect(lowHealthStress(0.75)).toBe(0);
    expect(lowHealthStress(0.5)).toBeGreaterThan(0.2);
    expect(lowHealthStress(0)).toBeCloseTo(1, 1);
  });

  it('picks heartbeat tier by current hp %', () => {
    expect(pickHeartbeatTier(0.9)).toBeNull();
    expect(pickHeartbeatTier(0.751)).toBeNull();
    expect(pickHeartbeatTier(0.75)).toBe(75);
    expect(pickHeartbeatTier(0.6)).toBe(75);
    expect(pickHeartbeatTier(0.5)).toBe(50);
    expect(pickHeartbeatTier(0.35)).toBe(50);
    expect(pickHeartbeatTier(0.3)).toBe(30);
    expect(pickHeartbeatTier(0.1)).toBe(30);
  });

  it('uses configured playback durations', () => {
    expect(HEARTBEAT_ATTACKED_SEC).toBe(3);
    expect(HEARTBEAT_TIER_SEC[75]).toBe(3);
    expect(HEARTBEAT_TIER_SEC[50]).toBe(6);
    expect(HEARTBEAT_TIER_SEC[30]).toBe(20);
  });

  it('computes hp ratio safely', () => {
    expect(hpRatio(8, 16)).toBe(0.5);
    expect(hpRatio(0, 0)).toBe(0);
  });
});
