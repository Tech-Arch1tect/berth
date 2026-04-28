import { test, expect } from '../fixtures/test';

test.describe('dashboard', () => {
  test('shows empty state when no servers are configured', async ({ page, api, auth }) => {
    const admin = await api.seedAdmin();
    await auth.loginViaUI(admin);

    await expect(page).toHaveURL('/');
    await expect(page.getByText(/no servers configured/i).first()).toBeVisible();
  });

  test('renders seeded server with statistics from the agent', async ({ page, api, auth }) => {
    const admin = await api.seedAdmin();
    const server = await api.seedServerWithAgent('atlas-prod');
    await api.registerAgentHandler(server.agentId, '/stacks/summary', 200, {
      total_stacks: 5,
      healthy_stacks: 4,
      unhealthy_stacks: 1,
    });

    await auth.loginViaUI(admin);
    await expect(page).toHaveURL('/');

    await expect(page.getByText('atlas-prod').first()).toBeVisible();

    const totalStacks = page.getByText('Total Stacks').locator('..');
    await expect(totalStacks.getByText('5', { exact: true })).toBeVisible();

    const healthy = page.getByText('Healthy', { exact: true }).locator('..');
    await expect(healthy.getByText('4', { exact: true })).toBeVisible();

    const unhealthy = page.getByText('Unhealthy', { exact: true }).locator('..');
    await expect(unhealthy.getByText('1', { exact: true })).toBeVisible();
  });

  test('shows zero counts when the agent reports an empty stack list', async ({
    page,
    api,
    auth,
  }) => {
    const admin = await api.seedAdmin();
    const server = await api.seedServerWithAgent('atlas-staging');
    await api.registerAgentHandler(server.agentId, '/stacks/summary', 200, {
      total_stacks: 0,
      healthy_stacks: 0,
      unhealthy_stacks: 0,
    });

    await auth.loginViaUI(admin);
    await page.goto('/');

    await expect(page.getByText('atlas-staging').first()).toBeVisible();
    await expect(page.getByText(/all systems healthy/i).first()).toBeVisible();
  });
});
