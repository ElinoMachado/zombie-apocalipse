import type { WreckedCarFrameCollisionProfile } from '../../assets/wreckedCars';

export type WreckedCarProfileOverride = Partial<WreckedCarFrameCollisionProfile>;

const STORAGE_KEY = 'csaa-wrecked-car-profile-overrides';

function readStorage(): Record<number, WreckedCarProfileOverride> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, WreckedCarProfileOverride>;
    const out: Record<number, WreckedCarProfileOverride> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const frame = Number(k);
      if (Number.isInteger(frame)) out[frame] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function writeStorage(all: Record<number, WreckedCarProfileOverride>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

/** Overrides de sessão (ferramenta Sprites). */
export function getRuntimeProfileOverrides(): Record<number, WreckedCarProfileOverride> {
  return readStorage();
}

export function getRuntimeProfileOverride(
  frame: number,
): WreckedCarProfileOverride | undefined {
  return readStorage()[frame];
}

export function setRuntimeProfileOverride(
  frame: number,
  patch: WreckedCarProfileOverride,
): void {
  const all = readStorage();
  all[frame] = { ...all[frame], ...patch };
  writeStorage(all);
}

export function clearRuntimeProfileOverride(frame: number): void {
  const all = readStorage();
  delete all[frame];
  writeStorage(all);
}

export function clearAllRuntimeProfileOverrides(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function listRuntimeOverrideFrames(): number[] {
  return Object.keys(readStorage())
    .map(Number)
    .filter((n) => Number.isInteger(n))
    .sort((a, b) => a - b);
}

export function diffProfileFromBase(
  base: WreckedCarProfileOverride & {
    swapAxes: boolean;
    artRotation: number;
    localOffsetX: number;
    localOffsetY: number;
  },
  merged: WreckedCarProfileOverride & {
    swapAxes: boolean;
    artRotation: number;
    localOffsetX: number;
    localOffsetY: number;
  },
): WreckedCarProfileOverride {
  const out: WreckedCarProfileOverride = {};
  if (merged.swapAxes !== base.swapAxes) out.swapAxes = merged.swapAxes;
  if (Math.abs(merged.artRotation - base.artRotation) > 1e-6) {
    out.artRotation = merged.artRotation;
  }
  if (Math.abs(merged.localOffsetX - base.localOffsetX) > 1e-6) {
    out.localOffsetX = merged.localOffsetX;
  }
  if (Math.abs(merged.localOffsetY - base.localOffsetY) > 1e-6) {
    out.localOffsetY = merged.localOffsetY;
  }
  return out;
}

export function saveMergedAsRuntimeOverride(
  frame: number,
  base: WreckedCarProfileOverride & {
    swapAxes: boolean;
    artRotation: number;
    localOffsetX: number;
    localOffsetY: number;
  },
  merged: WreckedCarProfileOverride & {
    swapAxes: boolean;
    artRotation: number;
    localOffsetX: number;
    localOffsetY: number;
  },
): void {
  const diff = diffProfileFromBase(base, merged);
  if (Object.keys(diff).length === 0) clearRuntimeProfileOverride(frame);
  else setRuntimeProfileOverride(frame, diff);
}

function formatOverrideValue(key: string, value: unknown): string {
  if (key === 'swapAxes') return String(value);
  if (typeof value === 'number') {
    const rounded = Math.round(value * 10000) / 10000;
    if (key === 'artRotation') return rounded.toString();
    return rounded.toString();
  }
  return JSON.stringify(value);
}

/** Gera snippet TypeScript para colar em wreckedCars.ts. */
export function exportProfileOverridesCode(
  overrides: Record<number, WreckedCarProfileOverride>,
): string {
  const frames = Object.keys(overrides)
    .map(Number)
    .filter((n) => Number.isInteger(n))
    .sort((a, b) => a - b);

  if (frames.length === 0) {
    return '// Nenhum ajuste para exportar.';
  }

  const lines = frames.map((frame) => {
    const o = overrides[frame]!;
    const props = Object.entries(o)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `    ${k}: ${formatOverrideValue(k, v)},`)
      .join('\n');
    return `  ${frame}: {\n${props}\n  },`;
  });

  return [
    '// Cole em src/assets/wreckedCars.ts → WRECKED_CAR_FRAME_OVERRIDES',
    'export const WRECKED_CAR_FRAME_OVERRIDES: Record<number, Partial<WreckedCarFrameCollisionProfile>> = {',
    ...lines,
    '};',
  ].join('\n');
}

/** JSON legível para backup / PR. */
export function exportProfileOverridesJson(
  overrides: Record<number, WreckedCarProfileOverride>,
): string {
  return JSON.stringify(overrides, null, 2);
}
