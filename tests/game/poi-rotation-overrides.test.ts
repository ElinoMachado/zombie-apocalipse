import { describe, expect, it } from 'vitest';
import { resolvePoiSpriteRotation } from '../../src/assets/poiSpriteRotation';
import { CRATE_POI_TYPE_ID } from '../../src/assets/crateBoxes';
import { exportPoiRotationOverridesCode } from '../../src/game/dev/poiRotationOverrides';

describe('poi rotation overrides', () => {
  it('emits TypeScript for permanent overrides', () => {
    const code = exportPoiRotationOverridesCode({
      'crate:3': { artRotation: 1.5708 },
    });
    expect(code).toContain('POI_SPRITE_ROTATION_OVERRIDES');
    expect(code).toContain('"crate"');
    expect(code).toContain('3:');
    expect(code).toContain('artRotation: 1.5708');
  });

  it('adds override on top of base rotation', () => {
    const base = 0.5;
    const result = resolvePoiSpriteRotation(CRATE_POI_TYPE_ID, 0, base);
    expect(result).toBe(base);
  });
});
