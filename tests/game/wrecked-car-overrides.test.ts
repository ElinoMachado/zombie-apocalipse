import { describe, expect, it } from 'vitest';
import { exportProfileOverridesCode } from '../../src/game/dev/wreckedCarProfileOverrides';

describe('wrecked car profile overrides export', () => {
  it('emits TypeScript for permanent overrides', () => {
    const code = exportProfileOverridesCode({
      42: { localOffsetY: -0.08, swapAxes: true },
    });
    expect(code).toContain('WRECKED_CAR_FRAME_OVERRIDES');
    expect(code).toContain('42:');
    expect(code).toContain('localOffsetY: -0.08');
  });
});
