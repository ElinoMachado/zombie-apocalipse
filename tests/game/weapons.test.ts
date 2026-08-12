import { describe, expect, it } from 'vitest';
import {
  canStartReload,
  createReloadState,
  createWeaponInstance,
  finishReload,
  meleeDurabilityRatio,
  rangedAmmoLabel,
  reloadProgress,
} from '../../src/game/combat/weapons';

describe('weapons', () => {
  it('shows mag / reserve (reserve excludes rounds already chambered)', () => {
    const p = createWeaponInstance('pistol');
    expect(rangedAmmoLabel(p)).toBe('4/0');
    p.ammoInMag = 3;
    p.reserve = 5;
    expect(rangedAmmoLabel(p)).toBe('3/5');
  });

  it('tracks knife durability ratio', () => {
    const k = createWeaponInstance('knife');
    expect(meleeDurabilityRatio(k)).toBe(1);
    k.durability = 25;
    expect(meleeDurabilityRatio(k)).toBe(0.25);
    k.durability = 0;
    expect(meleeDurabilityRatio(k)).toBe(0);
  });

  it('finishes reload from reserve into mag', () => {
    const p = createWeaponInstance('pistol');
    p.ammoInMag = 0;
    p.reserve = 4;
    expect(canStartReload(p)).toBe(true);
    finishReload(p);
    expect(p.ammoInMag).toBe(4);
    expect(p.reserve).toBe(0);
    expect(rangedAmmoLabel(p)).toBe('4/0');
  });

  it('tracks reload progress', () => {
    const state = createReloadState();
    state.active = true;
    state.duration = 2;
    state.left = 1;
    expect(reloadProgress(state)).toBeCloseTo(0.5);
  });
});
