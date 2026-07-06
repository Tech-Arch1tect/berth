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

  test('unauthenticated visit to an admin route redirects to login', async ({ page, api }) => {
    void api;
    await page.goto('/admin/users');
    await expect(page).toHaveURL(/\/auth\/login/);
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
  test('lists seeded servers with their status', async ({ page, api, auth }) => {
    const admin = await api.seedAdmin();
    await api.seedServerWithAgent('production-1');

    await auth.loginDirectly(admin);
    await page.goto('/admin/servers');

    await expect(page.getByText('production-1')).toBeVisible();
    await expect(page.getByText('Active', { exact: true })).toBeVisible();
  });

  test('admin creates a new server via the form, verifying TLS by default', async ({
    page,
    api,
    auth,
  }) => {
    const admin = await api.seedAdmin();
    await auth.loginDirectly(admin);
    await page.goto('/admin/servers');

    await page.getByRole('button', { name: 'Add Server', exact: true }).click();

    const form = page.locator('form');
    await expect(page.getByLabel('Skip SSL certificate verification')).not.toBeChecked();
    await form.locator('input[type="text"]').nth(0).fill('staging-eu');
    await form.locator('input[type="text"]').nth(1).fill('10.0.0.5');
    await form.locator('input[type="number"]').fill('9999');
    await form.locator('input[type="password"]').fill('s3cret-token');
    await form.getByRole('button', { name: 'Add Server' }).click();

    await expect(page.getByText('staging-eu')).toBeVisible();
    await expect(page.getByText('https://10.0.0.5:9999')).toBeVisible();
    await expect(page.getByText('TLS unverified')).not.toBeVisible();
  });

  test('admin deactivates and reactivates a server with a named confirmation', async ({
    page,
    api,
    auth,
  }) => {
    const admin = await api.seedAdmin();
    await api.seedServerWithAgent('toggle-target');
    await auth.loginDirectly(admin);
    await page.goto('/admin/servers');

    await page.getByRole('button', { name: 'Deactivate server toggle-target' }).click();
    await expect(page.getByText(/deactivate toggle-target\?/i)).toBeVisible();
    await page.getByRole('button', { name: 'Deactivate', exact: true }).click();
    await expect(page.getByText('Inactive', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Activate server toggle-target' }).click();
    await expect(page.getByText('Active', { exact: true })).toBeVisible();
  });
});

test.describe('admin pages render', () => {
  test('user roles page lists every role with its assignment state', async ({
    page,
    api,
    auth,
  }) => {
    const admin = await api.seedAdmin({ username: 'roles-admin' });
    await auth.loginDirectly(admin);

    await page.goto(`/admin/users/${admin.id}/roles`);
    await expect(page.getByRole('heading', { name: 'User Roles' })).toBeVisible();
    await expect(page.getByText(`Roles assigned to ${admin.username}`)).toBeVisible();
    await expect(page.getByText('Assigned', { exact: true }).first()).toBeVisible();
    await expect(
      page.getByRole('button', { name: `Remove role admin from ${admin.username}` })
    ).toBeVisible();
  });

  test('admin assigns and removes a role, with a named confirmation on remove', async ({
    page,
    api,
    auth,
  }) => {
    const admin = await api.seedAdmin();
    const target = await api.seedUser({ username: 'role-target' });
    await auth.loginDirectly(admin);

    await page.goto(`/admin/users/${target.id}/roles`);
    await page.getByRole('button', { name: 'Assign role admin to role-target' }).click();
    await expect(
      page.getByRole('button', { name: 'Remove role admin from role-target' })
    ).toBeVisible();

    await page.getByRole('button', { name: 'Remove role admin from role-target' }).click();
    await expect(page.getByText(/remove the role "admin" from role-target/i)).toBeVisible();
    await page.getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Assign role admin to role-target' })
    ).toBeVisible();
  });

  test('roles page lists the seeded role descriptions', async ({ page, api, auth }) => {
    const admin = await api.seedAdmin();
    await auth.loginDirectly(admin);

    await page.goto('/admin/roles');
    await expect(page).toHaveTitle(/Roles/i);
    const table = page.getByRole('table');
    await expect(table.getByText(/system administrator with full access/i)).toBeVisible();
    await expect(table.getByText(/standard user with basic permissions/i)).toBeVisible();
    await expect(table.getByText('System role')).toBeVisible();
  });

  test('admin creates a role via the modal and deletes it with a named confirmation', async ({
    page,
    api,
    auth,
  }) => {
    const admin = await api.seedAdmin();
    await auth.loginDirectly(admin);

    await page.goto('/admin/roles');
    await page.getByRole('button', { name: 'Add Role' }).click();
    await page.locator('#role-name').fill('auditor');
    await page.locator('#role-description').fill('Read-only reviewer');
    await page.locator('form').getByRole('button', { name: 'Add Role' }).click();
    await expect(page.getByText('Read-only reviewer')).toBeVisible();

    await page.getByRole('button', { name: 'Delete role auditor' }).click();
    await expect(page.getByText(/delete the role "auditor"/i)).toBeVisible();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText('Read-only reviewer')).not.toBeVisible();
  });

  test('role stack permissions page renders for a non-admin role', async ({ page, api, auth }) => {
    const admin = await api.seedAdmin();
    const token = await auth.loginDirectly(admin);

    const rolesRes = await page.request.get('/api/v1/admin/roles', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(rolesRes.ok()).toBeTruthy();
    const rolesBody = (await rolesRes.json()) as {
      data: { roles: Array<{ id: number; name: string; is_admin: boolean }> };
    };
    const userRole = rolesBody.data.roles.find((r) => r.is_admin === false);
    expect(userRole, 'expected a seeded non-admin role').toBeDefined();

    await page.goto(`/admin/roles/${userRole!.id}/stack-permissions`);
    await expect(page.getByText(/manage stack-based permissions for the/i)).toBeVisible();
  });

  test('admin adds a permission rule and removes it with a named confirmation', async ({
    page,
    api,
    auth,
  }) => {
    const admin = await api.seedAdmin();
    await api.seedServerWithAgent('perms-server');
    const token = await auth.loginDirectly(admin);

    const rolesRes = await page.request.get('/api/v1/admin/roles', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(rolesRes.ok()).toBeTruthy();
    const rolesBody = (await rolesRes.json()) as {
      data: { roles: Array<{ id: number; is_admin: boolean }> };
    };
    const userRole = rolesBody.data.roles.find((r) => !r.is_admin);
    expect(userRole, 'expected a seeded non-admin role').toBeDefined();

    await page.goto(`/admin/roles/${userRole!.id}/stack-permissions`);
    await page.getByRole('button', { name: 'Add Permission Rule' }).first().click();
    await page.locator('#rule-server').selectOption({ label: 'perms-server' });
    const firstPermission = page.locator('#add-rule-form input[type="checkbox"]').first();
    await firstPermission.check();
    const permissionName = await page
      .locator('#add-rule-form label[for^="permission-"]')
      .first()
      .innerText();
    await page.getByRole('button', { name: 'Add Rule' }).click();

    await expect(page.getByRole('heading', { name: 'perms-server' })).toBeVisible();
    await expect(page.getByText(permissionName, { exact: true })).toBeVisible();

    await page
      .getByRole('button', { name: `Remove ${permissionName} for perms-server pattern *` })
      .click();
    await expect(
      page.getByText(new RegExp(`remove the "${permissionName}" permission on perms-server`, 'i'))
    ).toBeVisible();
    await page.getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(page.getByText('No permission rules')).toBeVisible();
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
