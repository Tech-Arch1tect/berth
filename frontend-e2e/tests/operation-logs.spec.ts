import { test, expect } from '../fixtures/test';

test.describe('user operation logs page', () => {
  test('renders for an authenticated user', async ({ page, api, auth }) => {
    const admin = await api.seedAdmin();
    await auth.loginDirectly(admin);

    await page.goto('/operation-logs');
    await expect(page).toHaveTitle(/My Operation Logs/i);
  });
});
