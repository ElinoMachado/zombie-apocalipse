/**
 * Varre public/assets/audio (e src/audio) por ficheiros idle/attacking
 * e gera src/audio/zombieSoundManifest.ts para preload no jogo.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const publicAudio = path.join(root, 'public/assets/audio');
const srcAudio = path.join(root, 'src/audio');
const outFile = path.join(root, 'src/audio/zombieSoundManifest.ts');

const AUDIO_EXT = /\.(mp3|wav|ogg|m4a)$/i;
const SKIP = /knife|pistol|footstep|suspense|sus_corner|fire-campfire|loot-search|gun-dry|reload/i;

function listAudio(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && AUDIO_EXT.test(e.name))
    .map((e) => e.name);
}

function classify(name) {
  if (SKIP.test(name)) return null;
  const lower = name.toLowerCase();
  if (/attacking/.test(lower) || /(?:^|[-_])(attack|chase)(?:[-_.]|$)/i.test(lower)) {
    return 'attacking';
  }
  if (/idle/.test(lower) || /vagar|wander|groan/.test(lower)) {
    return 'idle';
  }
  return null;
}

function ensureInPublic(name) {
  const pub = path.join(publicAudio, name);
  if (fs.existsSync(pub)) return name;
  const src = path.join(srcAudio, name);
  if (fs.existsSync(src)) {
    fs.mkdirSync(publicAudio, { recursive: true });
    fs.copyFileSync(src, pub);
    return name;
  }
  return null;
}

const seen = new Set();
const idle = [];
const attacking = [];

for (const dir of [publicAudio, srcAudio]) {
  for (const name of listAudio(dir)) {
    if (seen.has(name.toLowerCase())) continue;
    const kind = classify(name);
    if (!kind) continue;
    const resolved = ensureInPublic(name);
    if (!resolved) continue;
    seen.add(name.toLowerCase());
    if (kind === 'idle') idle.push(resolved);
    else attacking.push(resolved);
  }
}

idle.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
attacking.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

const ts = `/** Gerado por tools/audio/sync-zombie-sounds.mjs — não editar à mão. */
export interface ZombieSoundEntry {
  key: string;
  file: string;
}

export const ZOMBIE_IDLE_SOUNDS: readonly ZombieSoundEntry[] = [
${idle.map((f, i) => `  { key: 'sfx-zombie-idle-${i}', file: 'assets/audio/${f}' },`).join('\n')}
];

export const ZOMBIE_ATTACKING_SOUNDS: readonly ZombieSoundEntry[] = [
${attacking.map((f, i) => `  { key: 'sfx-zombie-attacking-${i}', file: 'assets/audio/${f}' },`).join('\n')}
];
`;

fs.writeFileSync(outFile, ts, 'utf8');
console.log(`Zombie idle: ${idle.length}, attacking: ${attacking.length}`);
console.log(`Wrote ${outFile}`);
