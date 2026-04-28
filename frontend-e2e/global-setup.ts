process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');

export default async function globalSetup() {
  const t0 = Date.now();
  console.log('[e2e] building vite assets…');
  const build = spawnSync('npx', ['vite', 'build'], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  });
  if (build.status !== 0) {
    throw new Error(`vite build failed (exit ${build.status})`);
  }
  const t1 = Date.now();
  console.log(`[e2e] vite build done in ${t1 - t0}ms`);

  const tempRoot = mkdtempSync(join(tmpdir(), 'berth-e2e-'));
  const binaryPath = join(tempRoot, 'berth-e2e');
  console.log('[e2e] compiling berth-e2e binary…');
  const goBuild = spawnSync('go', ['build', '-tags', 'e2e', '-o', binaryPath, './'], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  });
  if (goBuild.status !== 0) {
    throw new Error(`go build -tags e2e failed (exit ${goBuild.status})`);
  }
  const t2 = Date.now();
  console.log(`[e2e] go build -tags e2e done in ${t2 - t1}ms`);

  process.env.BERTH_E2E_BINARY = binaryPath;
  process.env.BERTH_E2E_TEMP_ROOT = tempRoot;
  process.env.BERTH_E2E_REPO_ROOT = REPO_ROOT;

  console.log(`[e2e] globalSetup total ${t2 - t0}ms — workers will spawn their own instances`);
}
