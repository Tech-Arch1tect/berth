import { test, expect } from '../fixtures/test';
import type { ApiHelpers, SeededServer } from '../fixtures/test';

const STACK_NAME = 'web-frontend';

const stackDetailsBody = (state: 'running' | 'exited') => ({
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
          state,
        },
      ],
    },
  ],
});

async function mockStackDetailEndpoints(
  api: ApiHelpers,
  server: SeededServer,
  state: 'running' | 'exited'
): Promise<void> {
  await api.registerAgentHandler(
    server.agentId,
    `/stacks/${STACK_NAME}`,
    200,
    stackDetailsBody(state)
  );
  await api.registerAgentHandler(server.agentId, `/stacks/${STACK_NAME}/networks`, 200, []);
  await api.registerAgentHandler(server.agentId, `/stacks/${STACK_NAME}/volumes`, 200, []);
  await api.registerAgentHandler(server.agentId, `/stacks/${STACK_NAME}/environment`, 200, {
    services: {},
  });
  await api.registerAgentHandler(server.agentId, `/stacks/${STACK_NAME}/images`, 200, {
    images: [],
  });
}

test.describe('stack live updates', () => {
  test('a pushed stack status event refreshes the stack view without a reload', async ({
    page,
    api,
    auth,
  }) => {
    const admin = await api.seedAdmin();
    const server = await api.seedServerWithAgent('atlas-prod');
    await mockStackDetailEndpoints(api, server, 'running');

    await auth.loginDirectly(admin);
    await page.goto(`/servers/${server.serverId}/stacks/${STACK_NAME}`);

    await expect(page.getByText('nginx').first()).toBeVisible();
    await expect(page.getByText('all running')).toBeVisible();

    await mockStackDetailEndpoints(api, server, 'exited');
    await api.pushStackEvent({
      type: 'container_status',
      timestamp: new Date().toISOString(),
      server_id: server.serverId,
      stack_name: STACK_NAME,
      service_name: 'nginx',
      container_name: 'nginx-1',
      container_id: 'abc123',
      status: 'exited',
      image: 'nginx:alpine',
    });

    await expect(page.getByText('1 stopped')).toBeVisible({ timeout: 10_000 });
  });
});
