import { test, expect } from '../fixtures/test';

test.describe('server stacks list', () => {
  test('shows empty state when the agent returns no stacks', async ({ page, api, auth }) => {
    const admin = await api.seedAdmin();
    const server = await api.seedServerWithAgent('atlas-prod');
    await api.registerAgentHandler(server.agentId, '/stacks', 200, []);

    await auth.loginViaUI(admin);
    await page.goto(`/servers/${server.serverId}/stacks`);

    await expect(page.getByRole('heading', { name: /atlas-prod.*Docker Stacks/i })).toBeVisible();
    await expect(page.getByText(/no stacks found/i)).toBeVisible();
    await expect(
      page.getByText(/no docker compose stacks configured on any server/i)
    ).toBeVisible();
  });

  test('renders stacks returned by the agent', async ({ page, api, auth }) => {
    const admin = await api.seedAdmin();
    const server = await api.seedServerWithAgent('atlas-prod');
    await api.registerAgentHandler(server.agentId, '/stacks', 200, [
      {
        name: 'web-frontend',
        path: '/stacks/web-frontend',
        compose_file: 'docker-compose.yml',
        is_healthy: true,
        total_containers: 3,
        running_containers: 3,
      },
      {
        name: 'data-pipeline',
        path: '/stacks/data-pipeline',
        compose_file: 'docker-compose.yml',
        is_healthy: false,
        total_containers: 2,
        running_containers: 1,
      },
    ]);

    await auth.loginViaUI(admin);
    await page.goto(`/servers/${server.serverId}/stacks`);

    await expect(page.getByText('web-frontend')).toBeVisible();
    await expect(page.getByText('data-pipeline')).toBeVisible();
    await expect(page.getByText('3/3').first()).toBeVisible();
    await expect(page.getByText('1/2').first()).toBeVisible();
  });

  test('search filter narrows the visible stacks', async ({ page, api, auth }) => {
    const admin = await api.seedAdmin();
    const server = await api.seedServerWithAgent('atlas-prod');
    await api.registerAgentHandler(server.agentId, '/stacks', 200, [
      { name: 'web-frontend', path: '/s/w', compose_file: 'c.yml', is_healthy: true, total_containers: 1, running_containers: 1 },
      { name: 'data-pipeline', path: '/s/d', compose_file: 'c.yml', is_healthy: true, total_containers: 1, running_containers: 1 },
    ]);

    await auth.loginViaUI(admin);
    await page.goto(`/servers/${server.serverId}/stacks`);
    await expect(page.getByText('data-pipeline')).toBeVisible();

    await page.getByPlaceholder(/search/i).fill('web');

    await expect(page.getByText('web-frontend')).toBeVisible();
    await expect(page.getByText('data-pipeline')).not.toBeVisible();
  });
});
