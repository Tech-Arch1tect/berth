process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import { spawn, spawnSync, ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { E2E_BASE_URL } from './playwright.config';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');
const READY_TIMEOUT_MS = 30_000;

declare global {
  // eslint-disable-next-line no-var
  var __berthE2E: { proc: ChildProcess; tempDir: string } | undefined;
}

async function waitForReady(baseURL: string): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  let lastErr: unknown = null;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseURL}/__test__/reset`, { method: 'POST' });
      if (res.status === 204) return;
      lastErr = new Error(`reset returned ${res.status}`);
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`berth-e2e never became ready at ${baseURL}: ${String(lastErr)}`);
}

export default async function globalSetup() {
  console.log('[e2e] building vite assets…');
  const build = spawnSync('npm', ['run', 'build'], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  });
  if (build.status !== 0) {
    throw new Error(`vite build failed (exit ${build.status})`);
  }

  console.log('[e2e] compiling berth-e2e binary…');
  const tempDir = mkdtempSync(join(tmpdir(), 'berth-e2e-'));
  const binaryPath = join(tempDir, 'berth-e2e');
  const goBuild = spawnSync('go', ['build', '-tags', 'e2e', '-o', binaryPath, './'], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  });
  if (goBuild.status !== 0) {
    throw new Error(`go build -tags e2e failed (exit ${goBuild.status})`);
  }

  const url = new URL(E2E_BASE_URL);
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    E2E_MODE: 'true',
    SERVER_HOST: url.hostname,
    SERVER_PORT: url.port || '18080',
    DATABASE_DRIVER: 'sqlite',
    DATABASE_DSN: join(tempDir, 'berth-e2e.db'),
    DATABASE_AUTO_MIGRATE: 'true',
    INERTIA_DEVELOPMENT: 'false',
    INERTIA_ROOT_VIEW: 'app.html',
    APP_URL: E2E_BASE_URL,
    SESSION_ENABLED: 'true',
    SESSION_NAME: 'berth_e2e_session',
    SESSION_SECURE: 'false',
    CSRF_ENABLED: 'true',
    RATE_LIMIT_ENABLED: 'false',
    LOG_LEVEL: 'fatal',
    LOG_FORMAT: 'json',
    JWT_SECRET_KEY: randomBytes(32).toString('hex'),
    ENCRYPTION_SECRET: randomBytes(16).toString('hex'),
    AUTH_BCRYPT_COST: '4',
    AUTH_REQUIRE_UPPER: 'false',
    AUTH_REQUIRE_LOWER: 'false',
    AUTH_REQUIRE_NUMBER: 'false',
    AUTH_EMAIL_VERIFICATION_ENABLED: 'false',
    LOG_DIR: join(tempDir, 'logs'),
    MAIL_FROM_ADDRESS: 'noreply@berth.test',
    MAIL_FROM_NAME: 'Berth E2E',
    MAIL_HOST: '127.0.0.1',
    MAIL_PORT: '2525',
    MAIL_TEMPLATES_DIR: join(REPO_ROOT, 'templates', 'mail'),
  };

  console.log(`[e2e] launching berth-e2e on ${E2E_BASE_URL}…`);
  const proc = spawn(binaryPath, [], {
    cwd: REPO_ROOT,
    env,
    stdio: ['ignore', 'inherit', 'inherit'],
  });

  proc.on('exit', (code, signal) => {
    if (!global.__berthE2E) return;
    console.error(`[e2e] berth-e2e exited unexpectedly (code=${code}, signal=${signal})`);
  });

  global.__berthE2E = { proc, tempDir };

  try {
    await waitForReady(E2E_BASE_URL);
  } catch (err) {
    proc.kill('SIGTERM');
    if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
    global.__berthE2E = undefined;
    throw err;
  }

  console.log('[e2e] berth-e2e ready');
}
