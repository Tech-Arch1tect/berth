import { test, expect } from '../fixtures/test';

test.describe('auth', () => {
  test('login with valid credentials lands on dashboard', async ({ page, api, auth }) => {
    const user = await api.seedAdmin();

    await auth.loginViaUI(user);

    await expect(page).toHaveURL('/');
    await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();
  });

  test('login with wrong password keeps user on login page', async ({ page, api }) => {
    const user = await api.seedAdmin();

    await page.goto('/auth/login');
    await page.fill('input[name="username"]', user.username);
    await page.fill('input[name="password"]', 'not-the-real-password');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.getByText(/invalid credentials/i)).toBeVisible();
  });

  test('login with unknown username keeps user on login page', async ({ page, api }) => {
    await api.seedAdmin();

    await page.goto('/auth/login');
    await page.fill('input[name="username"]', 'no-such-user');
    await page.fill('input[name="password"]', 'whatever123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.getByText(/invalid credentials/i)).toBeVisible();
  });

  test('logout returns user to login page', async ({ page, api, auth }) => {
    const user = await api.seedAdmin();
    await auth.loginViaUI(user);

    await page.getByRole('button', { name: 'Log out' }).dispatchEvent('click');

    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('authenticated user visiting login is redirected away', async ({ page, api, auth }) => {
    const user = await api.seedAdmin();
    await auth.loginViaUI(user);

    await page.goto('/auth/login');
    await expect(page).toHaveURL('/');
  });

  test('protected route redirects unauthenticated user to login', async ({ page, api }) => {
    void api;
    await page.goto('/');
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
