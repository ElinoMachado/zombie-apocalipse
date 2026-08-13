import { describe, expect, it } from 'vitest';
import { ZOMBIE_VISION_OVERLAY_MAX_DRAW_DIST } from '../../src/game/combat/ZombieVisionOverlay';

/** Réplica da lógica de syncVisuals (viewport vs cone). */
function keepVisualRadius(viewportR: number, visionRadius: number): number {
  return Math.max(viewportR, ZOMBIE_VISION_OVERLAY_MAX_DRAW_DIST + visionRadius);
}

describe('zombie visual culling vs vision cones', () => {
  it('keeps sprites at least as far as cone overlay reach', () => {
    const viewportR = 494;
    const visionRadius = 108;
    const coneReach = ZOMBIE_VISION_OVERLAY_MAX_DRAW_DIST + visionRadius;
    const keepR = keepVisualRadius(viewportR, visionRadius);

    expect(keepR).toBeGreaterThanOrEqual(coneReach);
    expect(keepR).toBe(coneReach);

    const distBetween = 510;
    expect(distBetween <= coneReach).toBe(true);
    expect(distBetween <= keepR).toBe(true);
  });
});
