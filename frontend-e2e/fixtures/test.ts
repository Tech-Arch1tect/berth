import { test as base, expect, type APIRequestContext, type Page } from '@playwright/test';

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
  constructor(
    private readonly page: Page,
    private readonly request: APIRequestContext
  ) {}

  async loginViaUI(user: Pick<TestUser, 'username' | 'password'>): Promise<void> {
    await this.page.goto('/auth/login');
    await this.page.fill('input[name="username"]', user.username);
    await this.page.fill('input[name="password"]', user.password);
    await Promise.all([
      this.page.waitForURL((url) => !url.pathname.startsWith('/auth/login')),
      this.page.click('button[type="submit"]'),
    ]);
  }

  async loginViaApi(user: Pick<TestUser, 'username' | 'password'>): Promise<void> {
    const showLogin = await this.request.get('/auth/login');
    expect(showLogin.ok(), 'GET /auth/login').toBeTruthy();
    const csrfToken = await this.csrfToken();

    const res = await this.request.post('/auth/login', {
      headers: { 'X-CSRF-Token': csrfToken },
      form: {
        username: user.username,
        password: user.password,
      },
      maxRedirects: 0,
    });
    expect([302, 303]).toContain(res.status());
    expect(res.headers()['location']).not.toContain('/auth/login');
  }

  private async csrfToken(): Promise<string> {
    const cookies = await this.request.storageState();
    const csrf = cookies.cookies.find((c) => c.name === '_csrf');
    if (!csrf) throw new Error('_csrf cookie not present after GET /auth/login');
    return csrf.value;
  }
}

export const test = base.extend<{ api: ApiHelpers; auth: AuthHelpers }>({
  api: async ({ request }, use) => {
    const api = new ApiHelpers(request);
    await api.reset();
    await use(api);
  },
  auth: async ({ page, request, api: _api }, use) => {
    void _api;
    await use(new AuthHelpers(page, request));
  },
});

export { expect };
