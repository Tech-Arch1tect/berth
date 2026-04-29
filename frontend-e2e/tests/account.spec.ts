import { test, expect } from '../fixtures/test';

test.describe('account pages', () => {
  test('profile page renders for logged-in user', async ({ page, api, auth }) => {
    const admin = await api.seedAdmin();
    await auth.loginDirectly(admin);

    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: 'Profile', exact: true })).toBeVisible();
  });

  test('sessions page renders the active sessions heading', async ({ page, api, auth }) => {
    const admin = await api.seedAdmin();
    await auth.loginDirectly(admin);

    await page.goto('/sessions');
    await expect(page.getByRole('heading', { name: /active sessions/i })).toBeVisible();
  });

  test('api keys index renders for a logged-in user', async ({ page, api, auth }) => {
    const admin = await api.seedAdmin();
    await auth.loginDirectly(admin);

    await page.goto('/api-keys');
    await expect(page.getByRole('heading', { level: 1, name: 'API Keys' })).toBeVisible();
  });
});
