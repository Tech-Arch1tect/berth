import { test, expect } from '../fixtures/test';
import type { ApiHelpers, SeededServer } from '../fixtures/test';

const STACK_NAME = 'web-frontend';

const stackDetailsBody = {
  name: STACK_NAME,
  path: '/stacks/web-frontend',
  compose_file: 'docker-compose.yml',
  server_name: 'atlas-prod',
  services: [
    {
      name: 'nginx',
      image: 'nginx:alpine',
      ports: ['80:80'],
      containers: [
        {
          name: 'nginx-1',
          image: 'nginx:alpine',
          state: 'running',
          health: { status: 'healthy', failing_streak: 0 },
        },
      ],
    },
    {
      name: 'redis',
      image: 'redis:7',
      ports: ['6379:6379'],
      containers: [
        {
          name: 'redis-1',
          image: 'redis:7',
          state: 'running',
        },
      ],
    },
  ],
};

async function mockStackDetailEndpoints(api: ApiHelpers, server: SeededServer): Promise<void> {
  await api.registerAgentHandler(server.agentId, `/stacks/${STACK_NAME}`, 200, stackDetailsBody);
  await api.registerAgentHandler(server.agentId, `/stacks/${STACK_NAME}/networks`, 200, []);
  await api.registerAgentHandler(server.agentId, `/stacks/${STACK_NAME}/volumes`, 200, []);
  await api.registerAgentHandler(server.agentId, `/stacks/${STACK_NAME}/environment`, 200, {
    services: {},
  });
  await api.registerAgentHandler(server.agentId, `/stacks/${STACK_NAME}/images`, 200, { images: [] });
}

test.describe('stack details page', () => {
  test('renders services and containers from the agent', async ({ page, api, auth }) => {
    const admin = await api.seedAdmin();
    const server = await api.seedServerWithAgent('atlas-prod');
    await mockStackDetailEndpoints(api, server);

    await auth.loginViaUI(admin);
    await page.goto(`/servers/${server.serverId}/stacks/${STACK_NAME}`);

    await expect(page.getByText(STACK_NAME).first()).toBeVisible();
    await expect(page.getByText('nginx').first()).toBeVisible();
    await expect(page.getByText('redis').first()).toBeVisible();
  });

  test('reflects an unhealthy container state from the agent', async ({ page, api, auth }) => {
    const admin = await api.seedAdmin();
    const server = await api.seedServerWithAgent('atlas-prod');

    await api.registerAgentHandler(server.agentId, `/stacks/${STACK_NAME}`, 200, {
      ...stackDetailsBody,
      services: [
        {
          name: 'broken',
          image: 'broken:latest',
          containers: [
            {
              name: 'broken-1',
              image: 'broken:latest',
              state: 'exited',
              exit_code: 1,
            },
          ],
        },
      ],
    });
    await api.registerAgentHandler(server.agentId, `/stacks/${STACK_NAME}/networks`, 200, []);
    await api.registerAgentHandler(server.agentId, `/stacks/${STACK_NAME}/volumes`, 200, []);
    await api.registerAgentHandler(server.agentId, `/stacks/${STACK_NAME}/environment`, 200, {
      services: {},
    });
    await api.registerAgentHandler(server.agentId, `/stacks/${STACK_NAME}/images`, 200, {
      images: [],
    });

    await auth.loginViaUI(admin);
    await page.goto(`/servers/${server.serverId}/stacks/${STACK_NAME}`);

    await expect(page.getByText('broken').first()).toBeVisible();
    await expect(page.getByText(/health issues/i)).toBeVisible();
  });

  test('shows the stack name in the toolbar header', async ({ page, api, auth }) => {
    const admin = await api.seedAdmin();
    const server = await api.seedServerWithAgent('atlas-prod');
    await mockStackDetailEndpoints(api, server);

    await auth.loginViaUI(admin);
    await page.goto(`/servers/${server.serverId}/stacks/${STACK_NAME}`);

    const toolbar = page.locator('header, nav, [role="banner"]').first();
    await expect(toolbar.getByText(STACK_NAME).first()).toBeVisible();
  });
});
