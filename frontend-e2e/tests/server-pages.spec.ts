import { test, expect } from '../fixtures/test';

test.describe('server-scoped pages', () => {
  test('maintenance page renders for an admin', async ({ page, api, auth }) => {
    const admin = await api.seedAdmin();
    const server = await api.seedServerWithAgent('atlas-prod');

    await auth.loginDirectly(admin);
    await page.goto(`/servers/${server.serverId}/maintenance`);

    await expect(page).toHaveTitle(/Docker Maintenance - atlas-prod/i);
  });

  test('registries page renders for an admin', async ({ page, api, auth }) => {
    const admin = await api.seedAdmin();
    const server = await api.seedServerWithAgent('atlas-prod');

    await auth.loginDirectly(admin);
    await page.goto(`/servers/${server.serverId}/registries`);

    await expect(page).toHaveTitle(/Registry Credentials - atlas-prod/i);
  });
});
