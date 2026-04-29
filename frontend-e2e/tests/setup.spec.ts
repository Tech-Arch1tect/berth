import { test, expect } from '../fixtures/test';

test.describe('setup page', () => {
  test('admin setup page renders when no admin exists', async ({ page, api }) => {
    void api;
    await page.goto('/setup/admin');
    await expect(page.getByRole('heading', { name: /create admin account/i })).toBeVisible();
  });

  test('admin setup page returns 404 once an admin has been seeded', async ({ page, api }) => {
    await api.seedAdmin();
    const res = await page.goto('/setup/admin');
    expect(res?.status()).toBe(404);
  });
});
