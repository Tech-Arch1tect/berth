import { test, expect } from '../fixtures/test';
import type { ApiHelpers, SeededServer } from '../fixtures/test';

const STACK_NAME = 'web-frontend';
const OPERATION_ID = 'e2e-restart-op';

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
  await api.registerAgentHandler(server.agentId, `/stacks/${STACK_NAME}/images`, 200, {
    images: [],
  });
}

test.describe('stack operations', () => {
  test('a quick action starts an operation and streams its output to completion', async ({
    page,
    api,
    auth,
  }) => {
    const admin = await api.seedAdmin();
    const server = await api.seedServerWithAgent('atlas-prod');
    await mockStackDetailEndpoints(api, server);

    await api.registerAgentHandler(server.agentId, `/stacks/${STACK_NAME}/operations`, 200, {
      operationId: OPERATION_ID,
    });
    await api.registerAgentRawHandler(
      server.agentId,
      `/operations/${OPERATION_ID}/stream`,
      200,
      'text/event-stream',
      'data: {"type":"stdout","data":"Restarting nginx ...","timestamp":"2026-06-10T12:00:00Z"}\n\n' +
        'data: {"type":"complete","success":true,"exitCode":0,"timestamp":"2026-06-10T12:00:01Z"}\n\n'
    );

    await auth.loginDirectly(admin);
    await page.goto(`/servers/${server.serverId}/stacks/${STACK_NAME}`);
    await expect(page.getByText('nginx').first()).toBeVisible();

    await page.getByTitle('docker compose restart', { exact: true }).click();

    await expect(page.getByText(/refreshing stack data/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/operation failed/i)).not.toBeVisible();
  });

  test('a failed operation start surfaces an error', async ({ page, api, auth }) => {
    const admin = await api.seedAdmin();
    const server = await api.seedServerWithAgent('atlas-prod');
    await mockStackDetailEndpoints(api, server);

    await api.registerAgentHandler(server.agentId, `/stacks/${STACK_NAME}/operations`, 500, {
      error: 'compose project is locked',
    });

    await auth.loginDirectly(admin);
    await page.goto(`/servers/${server.serverId}/stacks/${STACK_NAME}`);
    await expect(page.getByText('nginx').first()).toBeVisible();

    await page.getByTitle('docker compose restart', { exact: true }).click();

    await expect(page.getByText(/failed to start operation/i)).toBeVisible({ timeout: 10_000 });
  });
});
