import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const versionConfig = JSON.parse(
  readFileSync(resolve(__dirname, 'version.config.json'), 'utf8'),
) as { major: number; minor: number; baselineCommitCount: number };

function resolveCommitCount(): number {
  try {
    return Number.parseInt(
      execSync('git rev-list --count HEAD', { encoding: 'utf8' }).trim(),
      10,
    );
  } catch {
    return versionConfig.baselineCommitCount;
  }
}

const patch = Math.max(0, resolveCommitCount() - versionConfig.baselineCommitCount);
const gameVersion = `${versionConfig.major}.${versionConfig.minor}.${patch}`;

export default defineConfig({
  define: {
    __GAME_VERSION__: JSON.stringify(gameVersion),
  },
  base: './',
  server: {
    port: 5173,
    open: true,
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'app.html'),
      },
    },
  },
});
