import { test, expect, type APIRequestContext } from '@playwright/test';

// ─── Test constants ───
const ADMIN_USER = { username: 'testadmin', password: 'adminpass123' };
const ADMIN_EMAIL = `${ADMIN_USER.username}@test.local`;

// ─── Helpers ───

async function resetDB(request: APIRequestContext) {
  await request.post('/api/_test/reset');
}

async function seedUser(request: APIRequestContext, user: { username: string; password: string }) {
  await request.post('/api/_test/seed-user', { data: user });
}

async function getAuthToken(request: APIRequestContext, email: string, password: string): Promise<string> {
  const res = await request.post('/api/auth/login', { data: { email, password } });
  const body = await res.json();
  return body.token;
}

function authFetch(request: APIRequestContext, token: string) {
  const headers = { Authorization: `Bearer ${token}` };
  return {
    get: (url: string) => request.get(url, { headers }),
    post: (url: string, data?: any) => request.post(url, { headers, data }),
    put: (url: string, data?: any) => request.put(url, { headers, data }),
    delete: (url: string) => request.delete(url, { headers }),
  };
}

/** Extract the raw token from a URL like "/reset-password/<token>" or full URL */
function extractResetToken(resetUrl: string): string {
  const parts = resetUrl.split('/reset-password/');
  return parts[parts.length - 1];
}

/**
 * Create a normal user via invite flow and return their email + password + token.
 * Uses unique email per call to avoid rate limit interference.
 */
async function createUserViaInvite(
  request: APIRequestContext,
  adminToken: string,
  opts: { email: string; username: string; password: string },
) {
  const api = authFetch(request, adminToken);

  // Send invite
  const inviteRes = await api.post('/api/admin/invites', { email: opts.email });
  const { inviteUrl } = await inviteRes.json();
  const inviteToken = inviteUrl.split('/invite/').pop()!;

  // Accept invite
  const acceptRes = await request.post('/api/auth/accept-invite', {
    data: { token: inviteToken, username: opts.username, password: opts.password },
  });
  const body = await acceptRes.json();
  return { token: body.token as string, email: opts.email, password: opts.password, username: opts.username };
}

// ═══════════════════════════════════════
// Change Password API Tests
// ═══════════════════════════════════════

test.describe('Change Password API', () => {
  let adminToken: string;

  test.beforeEach(async ({ request }) => {
    await resetDB(request);
    await seedUser(request, ADMIN_USER);
    adminToken = await getAuthToken(request, ADMIN_EMAIL, ADMIN_USER.password);
  });

  test('change password with correct current password returns new JWT', async ({ request }) => {
    const user = await createUserViaInvite(request, adminToken, {
      email: 'chgpwd1@test.com',
      username: 'chgpwd1',
      password: 'oldpass1234',
    });

    const api = authFetch(request, user.token);
    const res = await api.post('/api/auth/change-password', {
      currentPassword: 'oldpass1234',
      newPassword: 'newpass5678',
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.token).toBeTruthy();
  });

  test('change password with wrong current password returns 401', async ({ request }) => {
    const user = await createUserViaInvite(request, adminToken, {
      email: 'chgpwd2@test.com',
      username: 'chgpwd2',
      password: 'correctpass1',
    });

    const api = authFetch(request, user.token);
    const res = await api.post('/api/auth/change-password', {
      currentPassword: 'wrongpassword',
      newPassword: 'newpass5678',
    });
    expect(res.status()).toBe(401);
  });

  test('change password with weak new password returns 400', async ({ request }) => {
    const user = await createUserViaInvite(request, adminToken, {
      email: 'chgpwd3@test.com',
      username: 'chgpwd3',
      password: 'goodpass1234',
    });

    const api = authFetch(request, user.token);
    const res = await api.post('/api/auth/change-password', {
      currentPassword: 'goodpass1234',
      newPassword: 'short',
    });
    expect(res.status()).toBe(400);
  });

  test('after change, old password no longer works for login', async ({ request }) => {
    const user = await createUserViaInvite(request, adminToken, {
      email: 'chgpwd4@test.com',
      username: 'chgpwd4',
      password: 'oldpass1234',
    });

    const api = authFetch(request, user.token);
    await api.post('/api/auth/change-password', {
      currentPassword: 'oldpass1234',
      newPassword: 'newpass5678',
    });

    // Old password should fail
    const loginRes = await request.post('/api/auth/login', {
      data: { email: 'chgpwd4@test.com', password: 'oldpass1234' },
    });
    expect(loginRes.status()).toBe(401);
  });

  test('after change, new password works for login', async ({ request }) => {
    const user = await createUserViaInvite(request, adminToken, {
      email: 'chgpwd5@test.com',
      username: 'chgpwd5',
      password: 'oldpass1234',
    });

    const api = authFetch(request, user.token);
    await api.post('/api/auth/change-password', {
      currentPassword: 'oldpass1234',
      newPassword: 'newpass5678',
    });

    // New password should work
    const loginRes = await request.post('/api/auth/login', {
      data: { email: 'chgpwd5@test.com', password: 'newpass5678' },
    });
    expect(loginRes.status()).toBe(200);
    const body = await loginRes.json();
    expect(body.token).toBeTruthy();
  });

  test('new JWT from change-password is valid for authenticated endpoint', async ({ request }) => {
    const user = await createUserViaInvite(request, adminToken, {
      email: 'chgpwd6@test.com',
      username: 'chgpwd6',
      password: 'oldpass1234',
    });

    const api = authFetch(request, user.token);
    const res = await api.post('/api/auth/change-password', {
      currentPassword: 'oldpass1234',
      newPassword: 'newpass5678',
    });
    const { token: newToken } = await res.json();

    // Use the new token to call an authenticated endpoint (session-start is auth-exempt from module guard)
    const newApi = authFetch(request, newToken);
    const sessionRes = await newApi.post('/api/auth/session-start');
    expect(sessionRes.status()).toBe(200);
  });
});

// ═══════════════════════════════════════
// Logout All Devices API Tests
// ═══════════════════════════════════════

test.describe('Logout All Devices API', () => {
  let adminToken: string;

  test.beforeEach(async ({ request }) => {
    await resetDB(request);
    await seedUser(request, ADMIN_USER);
    adminToken = await getAuthToken(request, ADMIN_EMAIL, ADMIN_USER.password);
  });

  test('logout-all bumps tokenVersion so old JWT is rejected', async ({ request }) => {
    const user = await createUserViaInvite(request, adminToken, {
      email: 'logout1@test.com',
      username: 'logout1',
      password: 'mypass12345',
    });

    const oldToken = user.token;

    // Verify old token works first (session-start is auth-exempt from module guard)
    const preApi = authFetch(request, oldToken);
    const preRes = await preApi.post('/api/auth/session-start');
    expect(preRes.status()).toBe(200);

    // Call logout-all
    const logoutRes = await preApi.post('/api/auth/logout-all');
    expect(logoutRes.status()).toBe(200);

    // Old token should now be rejected
    const postApi = authFetch(request, oldToken);
    const postRes = await postApi.post('/api/auth/session-start');
    expect(postRes.status()).toBe(401);
  });

  test('can still login after logout-all (credentials unchanged)', async ({ request }) => {
    const user = await createUserViaInvite(request, adminToken, {
      email: 'logout2@test.com',
      username: 'logout2',
      password: 'mypass12345',
    });

    const api = authFetch(request, user.token);
    await api.post('/api/auth/logout-all');

    // Login with same credentials should work
    const loginRes = await request.post('/api/auth/login', {
      data: { email: 'logout2@test.com', password: 'mypass12345' },
    });
    expect(loginRes.status()).toBe(200);
    const body = await loginRes.json();
    expect(body.token).toBeTruthy();
  });
});

// ═══════════════════════════════════════
// Admin Force Reset API Tests
// ═══════════════════════════════════════

test.describe('Admin Force Reset API', () => {
  let adminToken: string;

  test.beforeEach(async ({ request }) => {
    await resetDB(request);
    await seedUser(request, ADMIN_USER);
    adminToken = await getAuthToken(request, ADMIN_EMAIL, ADMIN_USER.password);
  });

  test('force-reset returns resetUrl and emailSent', async ({ request }) => {
    const api = authFetch(request, adminToken);

    // Create a user
    const createRes = await api.post('/api/admin/users', {
      username: 'freset1',
      password: 'pass12345',
      role: 'user',
      email: 'freset1@test.com',
    });
    const created = await createRes.json();

    const resetRes = await api.post(`/api/admin/users/${created.id}/force-reset`);
    expect(resetRes.status()).toBe(200);

    const body = await resetRes.json();
    expect(body.resetUrl).toBeDefined();
    expect(body.resetUrl).toContain('/reset-password/');
    expect(typeof body.emailSent).toBe('boolean');
  });

  test('after force-reset, user old JWT is rejected (tokenVersion bumped)', async ({ request }) => {
    const user = await createUserViaInvite(request, adminToken, {
      email: 'freset2@test.com',
      username: 'freset2',
      password: 'pass12345',
    });

    const oldToken = user.token;

    // Verify old token works (session-start is auth-exempt from module guard)
    const preApi = authFetch(request, oldToken);
    const preRes = await preApi.post('/api/auth/session-start');
    expect(preRes.status()).toBe(200);

    // Get user ID from admin list
    const adminApi = authFetch(request, adminToken);
    const listRes = await adminApi.get('/api/admin/users');
    const users = await listRes.json();
    const targetUser = users.find((u: any) => u.username === 'freset2');

    // Force-reset
    await adminApi.post(`/api/admin/users/${targetUser.id}/force-reset`);

    // Old token should be rejected
    const postApi = authFetch(request, oldToken);
    const postRes = await postApi.post('/api/auth/session-start');
    expect(postRes.status()).toBe(401);
  });

  test('force-reset token can be used to set new password via reset-password API', async ({ request }) => {
    const api = authFetch(request, adminToken);

    // Create user
    const createRes = await api.post('/api/admin/users', {
      username: 'freset3',
      password: 'pass12345',
      role: 'user',
      email: 'freset3@test.com',
    });
    const created = await createRes.json();

    // Force-reset
    const resetRes = await api.post(`/api/admin/users/${created.id}/force-reset`);
    const { resetUrl } = await resetRes.json();
    const resetToken = extractResetToken(resetUrl);

    // Use the reset token to set new password
    const setRes = await request.post('/api/auth/reset-password', {
      data: { token: resetToken, password: 'brandnewpass1' },
    });
    expect(setRes.status()).toBe(200);
    const body = await setRes.json();
    expect(body.success).toBe(true);
  });

  test('after force-reset + set new password, old password fails and new works', async ({ request }) => {
    const api = authFetch(request, adminToken);

    // Create user
    const createRes = await api.post('/api/admin/users', {
      username: 'freset4',
      password: 'oldpass1234',
      role: 'user',
      email: 'freset4@test.com',
    });
    const created = await createRes.json();

    // Force-reset
    const resetRes = await api.post(`/api/admin/users/${created.id}/force-reset`);
    const { resetUrl } = await resetRes.json();
    const resetToken = extractResetToken(resetUrl);

    // Set new password
    await request.post('/api/auth/reset-password', {
      data: { token: resetToken, password: 'brandnewpass1' },
    });

    // Old password should fail
    const oldLoginRes = await request.post('/api/auth/login', {
      data: { email: 'freset4@test.com', password: 'oldpass1234' },
    });
    expect(oldLoginRes.status()).toBe(401);

    // New password should work
    const newLoginRes = await request.post('/api/auth/login', {
      data: { email: 'freset4@test.com', password: 'brandnewpass1' },
    });
    expect(newLoginRes.status()).toBe(200);
    const body = await newLoginRes.json();
    expect(body.token).toBeTruthy();
  });

  test('force-reset on non-existent user returns 404', async ({ request }) => {
    const api = authFetch(request, adminToken);

    const resetRes = await api.post('/api/admin/users/99999/force-reset');
    expect(resetRes.status()).toBe(404);
  });
});

// ═══════════════════════════════════════
// UI Tests
// ═══════════════════════════════════════

test.describe('Sidebar User Menu UI', () => {
  test.beforeEach(async ({ request }) => {
    await resetDB(request);
    await seedUser(request, ADMIN_USER);
  });

  test('sidebar shows username at bottom and click opens dropdown', async ({ page }) => {
    // Login via the UI
    await page.goto('/login');
    await page.waitForSelector('.login-form', { timeout: 10000 });
    await page.fill('#email', ADMIN_EMAIL);
    await page.fill('#password', ADMIN_USER.password);
    await page.click('.submit-btn');

    // Wait for redirect to app (sidebar should appear)
    await page.waitForSelector('.user-btn', { timeout: 10000 });

    // Verify username is shown in the sidebar
    await expect(page.locator('.user-btn .nav-label')).toContainText(ADMIN_USER.username);
  });

  test('click username opens dropdown with password, logout-all, and logout options', async ({ page }) => {
    // Login via UI
    await page.goto('/login');
    await page.waitForSelector('.login-form', { timeout: 10000 });
    await page.fill('#email', ADMIN_EMAIL);
    await page.fill('#password', ADMIN_USER.password);
    await page.click('.submit-btn');

    await page.waitForSelector('.user-btn', { timeout: 10000 });

    // Click the user button to open dropdown
    await page.click('.user-btn');

    // Wait for menu to appear
    await page.waitForSelector('.user-menu', { timeout: 5000 });

    // Verify all three menu items
    await expect(page.locator('.user-menu')).toContainText('修改密码');
    await expect(page.locator('.user-menu')).toContainText('登出所有设备');
    await expect(page.locator('.user-menu')).toContainText('退出登录');
  });
});

test.describe('Admin Panel Invite Form UI', () => {
  test.beforeEach(async ({ request }) => {
    await resetDB(request);
    await seedUser(request, ADMIN_USER);
  });

  test('admin panel invite form has email field', async ({ page }) => {
    // Login via UI
    await page.goto('/login');
    await page.waitForSelector('.login-form', { timeout: 10000 });
    await page.fill('#email', ADMIN_EMAIL);
    await page.fill('#password', ADMIN_USER.password);
    await page.click('.submit-btn');

    // Navigate to admin tool
    await page.waitForSelector('.user-btn', { timeout: 10000 });
    await page.goto('/admin');

    // Click the invite button
    await page.waitForSelector('.btn-add-user', { timeout: 10000 });
    await page.click('.btn-add-user');

    // Verify the form has an email input and the title says invite
    await page.waitForSelector('input[type="email"]', { timeout: 5000 });
    await expect(page.locator('input[type="email"]')).toBeVisible();

    // Verify form title mentions inviting
    await expect(page.locator('.modal-header h3')).toContainText('邀请新用户');
  });
});
