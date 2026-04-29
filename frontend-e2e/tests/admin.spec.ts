import { test, expect } from '../fixtures/test';

test.describe('admin access control', () => {
  test('non-admin sees 403 page on /admin/users', async ({ page, api, auth }) => {
    const user = await api.seedUser();
    await auth.loginDirectly(user);

    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: '403' })).toBeVisible();
    await expect(page.getByText(/insufficient permissions/i)).toBeVisible();
  });

  test('non-admin sees 403 page on /admin/servers', async ({ page, api, auth }) => {
    const user = await api.seedUser();
    await auth.loginDirectly(user);

    await page.goto('/admin/servers');
    await expect(page.getByRole('heading', { name: '403' })).toBeVisible();
  });

  test('unauthenticated visit to /admin lands on a 401 error page', async ({ page, api }) => {
    void api;
    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: '401' })).toBeVisible();
  });
});

test.describe('admin users page', () => {
  test('lists seeded users', async ({ page, api, auth }) => {
    const admin = await api.seedAdmin({ username: 'rootadmin', email: 'root@berth.test' });
    await api.seedUser({ username: 'staff-alice', email: 'alice@berth.test' });
    await api.seedUser({ username: 'staff-bob', email: 'bob@berth.test' });

    await auth.loginDirectly(admin);
    await page.goto('/admin/users');

    const table = page.getByRole('table');
    await expect(table.getByText('rootadmin')).toBeVisible();
    await expect(table.getByText('staff-alice')).toBeVisible();
    await expect(table.getByText('staff-bob')).toBeVisible();
  });

  test('admin creates a new user via the form', async ({ page, api, auth }) => {
    const admin = await api.seedAdmin();
    await auth.loginDirectly(admin);
    await page.goto('/admin/users');

    await page.getByRole('button', { name: 'Create User' }).click();
    await page.locator('#username').fill('new-recruit');
    await page.locator('#email').fill('recruit@berth.test');
    await page.locator('#password').fill('password123');
    await page.locator('#password_confirm').fill('password123');
    await page.locator('form').getByRole('button', { name: 'Create User' }).click();

    await expect(page.getByText('recruit@berth.test')).toBeVisible();
  });
});

test.describe('admin servers page', () => {
  test('lists seeded servers', async ({ page, api, auth }) => {
    const admin = await api.seedAdmin();
    const server = await api.seedServerWithAgent('production-1');

    await auth.loginDirectly(admin);
    await page.goto('/admin/servers');

    await expect(page.getByText('production-1')).toBeVisible();
    await expect(page.getByText(`#${server.serverId}`)).toBeVisible();
  });

  test('admin creates a new server via the form', async ({ page, api, auth }) => {
    const admin = await api.seedAdmin();
    await auth.loginDirectly(admin);
    await page.goto('/admin/servers');

    await page.getByRole('button', { name: 'Add Server', exact: true }).click();

    const form = page.locator('form');
    await form.locator('input[type="text"]').nth(0).fill('staging-eu');
    await form.locator('input[type="text"]').nth(1).fill('10.0.0.5');
    await form.locator('input[type="number"]').fill('9999');
    await form.locator('input[type="password"]').fill('s3cret-token');
    await form.getByRole('button', { name: 'Add Server' }).click();

    await expect(page.getByText('staging-eu')).toBeVisible();
    await expect(page.getByText('https://10.0.0.5:9999')).toBeVisible();
  });
});

test.describe('admin pages render', () => {
  test('user roles page renders for an existing user', async ({ page, api, auth }) => {
    const admin = await api.seedAdmin();
    await auth.loginDirectly(admin);

    await page.goto(`/admin/users/${admin.id}/roles`);
    await expect(page.getByText(/current roles/i)).toBeVisible();
    await expect(page.getByText(/available roles/i)).toBeVisible();
  });

  test('roles page lists the seeded role descriptions', async ({ page, api, auth }) => {
    const admin = await api.seedAdmin();
    await auth.loginDirectly(admin);

    await page.goto('/admin/roles');
    await expect(page).toHaveTitle(/Role Management/i);
    const table = page.getByRole('table');
    await expect(table.getByText(/system administrator with full access/i)).toBeVisible();
    await expect(table.getByText(/standard user with basic permissions/i)).toBeVisible();
  });

  test('role stack permissions page renders for a non-admin role', async ({ page, api, auth }) => {
    const admin = await api.seedAdmin();
    await auth.loginDirectly(admin);

    const rolesRes = await page.request.get('/api/v1/admin/roles');
    expect(rolesRes.ok()).toBeTruthy();
    const rolesBody = (await rolesRes.json()) as {
      data: { roles: Array<{ id: number; name: string; is_admin: boolean }> };
    };
    const userRole = rolesBody.data.roles.find((r) => r.is_admin === false);
    expect(userRole, 'expected a seeded non-admin role').toBeDefined();

    await page.goto(`/admin/roles/${userRole!.id}/stack-permissions`);
    await expect(
      page.getByText(/manage stack-based permissions for the/i)
    ).toBeVisible();
  });

  test('security audit logs page renders', async ({ page, api, auth }) => {
    const admin = await api.seedAdmin();
    await auth.loginDirectly(admin);

    await page.goto('/admin/security-audit-logs');
    await expect(page).toHaveTitle(/Security Audit Logs/i);
  });

  test('agent update page renders', async ({ page, api, auth }) => {
    const admin = await api.seedAdmin();
    await auth.loginDirectly(admin);

    await page.goto('/admin/agent-update');
    await expect(page.getByRole('heading', { name: /agent updates/i })).toBeVisible();
  });

  test('admin operation logs page renders', async ({ page, api, auth }) => {
    const admin = await api.seedAdmin();
    await auth.loginDirectly(admin);

    await page.goto('/admin/operation-logs');
    await expect(page).toHaveTitle(/Operation Logs/i);
  });

  test('migration page renders', async ({ page, api, auth }) => {
    const admin = await api.seedAdmin();
    await auth.loginDirectly(admin);

    await page.goto('/admin/migration');
    await expect(page.getByText(/data migration/i)).toBeVisible();
  });
});
