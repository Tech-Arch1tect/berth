import { test as base, expect, type APIRequestContext, type Page } from '@playwright/test';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const BASE_PORT = 18080;
const READY_TIMEOUT_MS = 30_000;

export interface BerthInstance {
  baseURL: string;
  port: number;
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

export interface TestUser {
  id: number;
  username: string;
  email: string;
  password: string;
}

export interface SeededServer {
  serverId: number;
  agentId: number;
  agentUrl: string;
}

export interface SeedUserOptions {
  username?: string;
  email?: string;
  password?: string;
  admin?: boolean;
  emailVerified?: boolean;
}

export class ApiHelpers {
  constructor(private readonly request: APIRequestContext) {}

  async reset(): Promise<void> {
    const res = await this.request.post('/__test__/reset');
    expect(res.status(), 'reset endpoint').toBe(204);
  }

  async seedUser(opts: SeedUserOptions = {}): Promise<TestUser> {
    const username = opts.username ?? `user-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const email = opts.email ?? `${username}@berth.test`;
    const password = opts.password ?? 'password123';
    const res = await this.request.post('/__test__/users', {
      data: {
        username,
        email,
        password,
        admin: opts.admin ?? false,
        email_verified: opts.emailVerified ?? true,
      },
    });
    expect(res.status(), 'seed user').toBe(201);
    const body = (await res.json()) as { id: number; username: string; email: string };
    return { id: body.id, username: body.username, email: body.email, password };
  }

  async seedAdmin(opts: Omit<SeedUserOptions, 'admin'> = {}): Promise<TestUser> {
    return this.seedUser({ ...opts, admin: true });
  }

  async enableTOTP(userId: number): Promise<void> {
    const res = await this.request.post(`/__test__/users/${userId}/totp`);
    expect(res.status(), 'enable TOTP').toBe(204);
  }

  async seedServerWithAgent(name = `server-${Date.now()}`): Promise<SeededServer> {
    const res = await this.request.post('/__test__/servers', { data: { name } });
    expect(res.status(), 'seed server').toBe(201);
    const body = (await res.json()) as {
      server_id: number;
      agent_id: number;
      agent_url: string;
    };
    return { serverId: body.server_id, agentId: body.agent_id, agentUrl: body.agent_url };
  }

  async registerAgentHandler(
    agentId: number,
    path: string,
    status: number,
    body: unknown
  ): Promise<void> {
    const res = await this.request.post(`/__test__/agents/${agentId}/handlers`, {
      data: { path, status, body },
    });
    expect(res.status(), 'register agent handler').toBe(204);
  }

  async resetAgent(agentId: number): Promise<void> {
    const res = await this.request.post(`/__test__/agents/${agentId}/reset`);
    expect(res.status(), 'reset agent').toBe(204);
  }
}

export class AuthHelpers {
  constructor(private readonly page: Page) {}

  async loginViaUI(user: Pick<TestUser, 'username' | 'password'>): Promise<void> {
    await this.page.goto('/auth/login');
    await this.page.fill('input[name="username"]', user.username);
    await this.page.fill('input[name="password"]', user.password);
    await Promise.all([
      this.page.waitForURL((url) => !url.pathname.startsWith('/auth/login')),
      this.page.click('button[type="submit"]'),
    ]);
  }

  async loginDirectly(user: Pick<TestUser, 'username' | 'password'>): Promise<string> {
    const res = await this.page.request.post('/api/v1/auth/login', {
      data: { username: user.username, password: user.password },
    });
    expect(res.status(), 'POST /api/v1/auth/login').toBe(200);
    const body = (await res.json()) as { data: { access_token: string } };
    return body.data.access_token;
  }
}

interface TestFixtures {
  api: ApiHelpers;
  auth: AuthHelpers;
}

interface WorkerFixtures {
  berthInstance: BerthInstance;
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  berthInstance: [
    async ({}, use, workerInfo) => {
      const binaryPath = process.env.BERTH_E2E_BINARY;
      const tempRoot = process.env.BERTH_E2E_TEMP_ROOT;
      const repoRoot = process.env.BERTH_E2E_REPO_ROOT;
      if (!binaryPath || !tempRoot || !repoRoot) {
        throw new Error(
          'globalSetup did not populate BERTH_E2E_BINARY/BERTH_E2E_TEMP_ROOT/BERTH_E2E_REPO_ROOT'
        );
      }

      const port = BASE_PORT + workerInfo.workerIndex;
      const baseURL = `https://127.0.0.1:${port}`;
      const workerDir = join(tempRoot, `worker-${workerInfo.workerIndex}`);
      mkdirSync(workerDir, { recursive: true });

      const env: NodeJS.ProcessEnv = {
        ...process.env,
        E2E_MODE: 'true',
        SERVER_HOST: '127.0.0.1',
        SERVER_PORT: String(port),
        DATABASE_DRIVER: 'sqlite',
        DATABASE_DSN: join(workerDir, 'berth-e2e.db'),
        DATABASE_AUTO_MIGRATE: 'true',
        FRONTEND_DEVELOPMENT: 'false',
        APP_URL: baseURL,
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
        LOG_DIR: join(workerDir, 'logs'),
        MAIL_FROM_ADDRESS: 'noreply@berth.test',
        MAIL_FROM_NAME: 'Berth E2E',
        MAIL_HOST: '127.0.0.1',
        MAIL_PORT: '2525',
        MAIL_TEMPLATES_DIR: join(repoRoot, 'templates', 'mail'),
      };

      const tSpawn = Date.now();
      const proc = spawn(binaryPath, [], {
        cwd: repoRoot,
        env,
        stdio: ['ignore', 'inherit', 'inherit'],
      });

      try {
        await waitForReady(baseURL);
      } catch (err) {
        proc.kill('SIGTERM');
        throw err;
      }
      const tReady = Date.now();
      console.log(
        `[e2e] worker ${workerInfo.workerIndex} ready on :${port} in ${tReady - tSpawn}ms`
      );

      await use({ baseURL, port });

      if (proc.exitCode === null && proc.signalCode === null) {
        proc.kill('SIGTERM');
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            proc.kill('SIGKILL');
            resolve();
          }, 3000);
          proc.once('exit', () => {
            clearTimeout(timeout);
            resolve();
          });
        });
      }
      if (existsSync(workerDir)) {
        rmSync(workerDir, { recursive: true, force: true });
      }
    },
    { scope: 'worker' },
  ],

  baseURL: async ({ berthInstance }, use) => {
    await use(berthInstance.baseURL);
  },

  api: async ({ request }, use) => {
    const api = new ApiHelpers(request);
    await api.reset();
    await use(api);
  },

  auth: async ({ page, api: _api }, use) => {
    void _api;
    await use(new AuthHelpers(page));
  },
});

export { expect };
