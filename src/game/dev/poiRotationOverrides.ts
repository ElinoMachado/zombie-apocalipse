import type { PoiSpriteRotationOverride } from '../../assets/poiSpriteRotation';

const STORAGE_KEY = 'csaa-poi-sprite-rotation-overrides';

function storageKey(typeId: string, frame: number): string {
  return `${typeId}:${frame}`;
}

function readStorage(): Record<string, PoiSpriteRotationOverride> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, PoiSpriteRotationOverride>;
  } catch {
    return {};
  }
}

function writeStorage(all: Record<string, PoiSpriteRotationOverride>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function getRuntimePoiRotationOverrides(): Record<
  string,
  PoiSpriteRotationOverride
> {
  return readStorage();
}

export function getRuntimePoiRotationOverride(
  typeId: string,
  frame: number,
): PoiSpriteRotationOverride | undefined {
  return readStorage()[storageKey(typeId, frame)];
}

export function setRuntimePoiRotationOverride(
  typeId: string,
  frame: number,
  patch: PoiSpriteRotationOverride,
): void {
  const all = readStorage();
  const key = storageKey(typeId, frame);
  all[key] = { ...all[key], ...patch };
  writeStorage(all);
}

export function clearRuntimePoiRotationOverride(
  typeId: string,
  frame: number,
): void {
  const all = readStorage();
  delete all[storageKey(typeId, frame)];
  writeStorage(all);
}

export function clearAllRuntimePoiRotationOverrides(): void {
  localStorage.removeItem(STORAGE_KEY);
}

function formatOverrideValue(key: string, value: unknown): string {
  if (typeof value === 'number') {
    return (Math.round(value * 10000) / 10000).toString();
  }
  return JSON.stringify(value);
}

/** Agrupa overrides flat em typeId → frame → patch. */
export function groupPoiRotationOverrides(
  flat: Record<string, PoiSpriteRotationOverride>,
): Record<string, Record<number, PoiSpriteRotationOverride>> {
  const out: Record<string, Record<number, PoiSpriteRotationOverride>> = {};
  for (const [key, patch] of Object.entries(flat)) {
    const sep = key.lastIndexOf(':');
    if (sep <= 0) continue;
    const typeId = key.slice(0, sep);
    const frame = Number(key.slice(sep + 1));
    if (!Number.isInteger(frame)) continue;
    if (!out[typeId]) out[typeId] = {};
    out[typeId]![frame] = patch;
  }
  return out;
}

/** Gera snippet TypeScript para colar em poiSpriteRotation.ts. */
export function exportPoiRotationOverridesCode(
  flat: Record<string, PoiSpriteRotationOverride>,
): string {
  const grouped = groupPoiRotationOverrides(flat);
  const typeIds = Object.keys(grouped).sort();

  if (typeIds.length === 0) {
    return '// Nenhum ajuste para exportar.';
  }

  const blocks = typeIds.map((typeId) => {
    const frames = Object.keys(grouped[typeId]!)
      .map(Number)
      .sort((a, b) => a - b);
    const frameLines = frames.map((frame) => {
      const o = grouped[typeId]![frame]!;
      const props = Object.entries(o)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `      ${k}: ${formatOverrideValue(k, v)},`)
        .join('\n');
      return `    ${frame}: {\n${props}\n    },`;
    });
    return `  ${JSON.stringify(typeId)}: {\n${frameLines.join('\n')}\n  },`;
  });

  return [
    '// Cole em src/assets/poiSpriteRotation.ts → POI_SPRITE_ROTATION_OVERRIDES',
    'export const POI_SPRITE_ROTATION_OVERRIDES: Record<',
    '  string,',
    '  Record<number, PoiSpriteRotationOverride>',
    '> = {',
    ...blocks,
    '};',
  ].join('\n');
}

export function exportPoiRotationOverridesJson(
  flat: Record<string, PoiSpriteRotationOverride>,
): string {
  return JSON.stringify(groupPoiRotationOverrides(flat), null, 2);
}

export function saveMergedPoiRotationOverride(
  typeId: string,
  frame: number,
  artRotation: number,
): void {
  if (Math.abs(artRotation) < 1e-6) {
    clearRuntimePoiRotationOverride(typeId, frame);
    return;
  }
  setRuntimePoiRotationOverride(typeId, frame, { artRotation });
}
