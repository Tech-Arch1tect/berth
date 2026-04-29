import { test, expect } from '../fixtures/test';

test.describe('public auth pages render', () => {
  test('password reset request page renders the form', async ({ page }) => {
    await page.goto('/auth/password-reset');
    await expect(page.getByRole('heading', { name: /reset your password/i })).toBeVisible();
    await expect(page.getByPlaceholder(/email address/i)).toBeVisible();
  });

  test('password reset confirm with an invalid token redirects to request page', async ({
    page,
  }) => {
    await page.goto('/auth/password-reset/confirm?token=not-a-real-token');
    await expect(page).toHaveURL(/\/auth\/password-reset(\?|$)/);
  });

  test('verify email with an invalid token redirects to login', async ({ page }) => {
    await page.goto('/auth/verify-email?token=not-a-real-token');
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});

test.describe('TOTP setup page', () => {
  test('renders QR code section for an authenticated user', async ({ page, api, auth }) => {
    const admin = await api.seedAdmin();
    await auth.loginDirectly(admin);

    await page.goto('/auth/totp/setup');
    await expect(page.getByText(/setup two-factor authentication/i)).toBeVisible();
  });
});
