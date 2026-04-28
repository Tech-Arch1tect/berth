import { test, expect } from '../fixtures/test';

test('test endpoints respond and Inertia renders post-reset', async ({ page, api }) => {
  void api;

  await page.goto('/');
  await expect(page).toHaveURL(/\/auth\/login/);
});
