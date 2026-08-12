import { describe, expect, it } from 'vitest';
import {
  pickWreckedCarFrame,
  WRECKED_CAR_COLS,
  WRECKED_CAR_FRAME_COUNT,
  WRECKED_CAR_ROW_END,
  WRECKED_CAR_ROW_START,
  wreckedCarCollisionObb,
  wreckedCarCollisionRect,
  wreckedCarFrameRow,
  circleHitsCarObb,
} from '../../src/assets/wreckedCars';

describe('wreckedCars', () => {
  it('picks frames from all sheet rows', () => {
    for (let i = 0; i < 40; i += 1) {
      const frame = pickWreckedCarFrame(`seed-${i}`);
      const row = Math.floor(frame / WRECKED_CAR_COLS);
      expect(row).toBeGreaterThanOrEqual(WRECKED_CAR_ROW_START);
      expect(row).toBeLessThanOrEqual(WRECKED_CAR_ROW_END);
      expect(frame).toBeGreaterThanOrEqual(0);
      expect(frame).toBeLessThan(WRECKED_CAR_FRAME_COUNT);
    }
  });

  it('is stable for the same seed', () => {
    expect(pickWreckedCarFrame('amb-42')).toBe(pickWreckedCarFrame('amb-42'));
  });

  it('OBB is tighter than rotated AABB at diagonal corners', () => {
    const ts = 12;
    const cx = 100;
    const cy = 100;
    const rot = Math.PI / 4;
    const obb = wreckedCarCollisionObb(cx, cy, ts, rot);
    const aabb = wreckedCarCollisionRect(cx, cy, ts, rot);

    const cornerX = aabb.x - 4;
    const cornerY = aabb.y - 4;
    expect(circleHitsCarObb(cornerX, cornerY, 4, obb)).toBe(false);
  });

  it('uses long axis along sprite height for top-down frames', () => {
    const ts = 12;
    const frame = WRECKED_CAR_ROW_START * WRECKED_CAR_COLS;
    const obb = wreckedCarCollisionObb(0, 0, ts, 0, 1, frame);

    expect(wreckedCarFrameRow(frame)).toBe(WRECKED_CAR_ROW_START);
    expect(obb.halfH).toBeGreaterThan(obb.halfW);
  });
});
