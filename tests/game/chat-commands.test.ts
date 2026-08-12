import { describe, expect, it } from 'vitest';
import {
  createHitboxDebugState,
  parseChatCommand,
} from '../../src/game/debug/chatCommands';

describe('chat commands', () => {
  it('toggles car hit-boxes on and off', () => {
    const state = createHitboxDebugState();
    expect(state.showCarHitboxes).toBe(false);

    const on = parseChatCommand('/hit-boxes cars on', state);
    expect(on.error).toBeFalsy();
    expect(state.showCarHitboxes).toBe(true);

    const off = parseChatCommand('/hit-boxes cars off', state);
    expect(off.error).toBeFalsy();
    expect(state.showCarHitboxes).toBe(false);
  });

  it('rejects unknown commands', () => {
    const state = createHitboxDebugState();
    const res = parseChatCommand('/foo bar', state);
    expect(res.error).toBe(true);
  });
});
