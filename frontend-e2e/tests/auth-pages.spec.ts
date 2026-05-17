import { test, expect } from '../fixtures/test';

test.describe('public auth pages render', () => {
  test('password reset request page renders the form', async ({ page }) => {
    await page.goto('/auth/password-reset');
    await expect(page.getByRole('heading', { name: /reset your password/i })).toBeVisible();
    await expect(page.getByPlaceholder(/email address/i)).toBeVisible();
  });

  test('password reset confirm page renders the new-password form', async ({ page }) => {
    await page.goto('/auth/password-reset/confirm?token=not-a-real-token');
    await expect(page.getByRole('heading', { name: /choose a new password/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /reset password/i })).toBeVisible();
  });

  test('verify email page renders the verification prompt', async ({ page }) => {
    await page.goto('/auth/verify-email?token=not-a-real-token');
    await expect(page.getByRole('heading', { name: /verify your email/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /verify email address/i })).toBeVisible();
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

test.describe('TOTP verify page', () => {
  test('renders code prompt for a TOTP-enabled user awaiting second factor', async ({
    page,
    api,
    auth,
  }) => {
    const admin = await api.seedAdmin();
    await api.enableTOTP(admin.id);
    await auth.loginDirectly(admin);

    await page.goto('/auth/totp/verify');
    await expect(page.getByRole('heading', { name: /two-factor authentication/i })).toBeVisible();
    await expect(page.getByPlaceholder('123456')).toBeVisible();
  });
});
