import { describe, expect, it, vi } from 'vitest';
import {
  BLEED_DAMAGE_INTERVAL_SEC,
  SurvivalState,
} from '../../src/game/survival/SurvivalState';

describe('bleeding damage', () => {
  it('causes 1 HP per minute while bleeding', () => {
    const survival = new SurvivalState();
    survival.bleeding = true;
    const takeDamage = vi.fn((n: number) => n);
    const target = {
      alive: true,
      hp: 20,
      maxHp: 20,
      heal: () => 0,
      takeDamage,
      stamina: 100,
      maxStamina: 100,
    };

    survival.update(BLEED_DAMAGE_INTERVAL_SEC * 1000 - 1, target);
    expect(takeDamage).not.toHaveBeenCalled();

    survival.update(2, target);
    expect(takeDamage).toHaveBeenCalledTimes(1);
    expect(takeDamage).toHaveBeenCalledWith(1);
  });

  it('stopBleeding resets tick accumulator', () => {
    const survival = new SurvivalState();
    survival.bleeding = true;
    const takeDamage = vi.fn(() => 0);
    const target = {
      alive: true,
      hp: 10,
      maxHp: 10,
      heal: () => 0,
      takeDamage,
      stamina: 100,
      maxStamina: 100,
    };

    survival.update(59_000, target);
    expect(takeDamage).not.toHaveBeenCalled();

    survival.stopBleeding();
    survival.bleeding = true;
    survival.update(59_000, target);
    expect(takeDamage).not.toHaveBeenCalled();
  });
});
