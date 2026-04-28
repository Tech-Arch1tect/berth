import { test, expect } from '@playwright/test';

test('test endpoints respond and Inertia renders post-reset', async ({ page, request }) => {
  const reset = await request.post('/__test__/reset');
  expect(reset.status()).toBe(204);

  await page.goto('/');
  await expect(page).toHaveURL(/\/auth\/login/);
});
