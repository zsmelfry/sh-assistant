import { test, expect, type APIRequestContext } from '@playwright/test';

// ─── Test constants ───
const ADMIN_USER = { username: 'testadmin', password: 'adminpass123' };
const INVITE_EMAIL = 'invited@example.com';

// ─── Helpers ───

async function resetDB(request: APIRequestContext) {
  await request.post('/api/_test/reset');
}

async function seedUser(request: APIRequestContext, user: { username: string; password: string }) {
  await request.post('/api/_test/seed-user', { data: user });
}

async function getAuthToken(request: APIRequestContext, user: { username: string; password: string; email?: string }): Promise<string> {
  const email = user.email || `${user.username}@test.local`;
  const res = await request.post('/api/auth/login', { data: { email, password: user.password } });
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

/** Extract the raw token from an inviteUrl like "/invite/<token>" or "http://host/invite/<token>" */
function extractToken(inviteUrl: string): string {
  const parts = inviteUrl.split('/invite/');
  return parts[parts.length - 1];
}

// ═══════════════════════════════════════
// Invite Flow API Tests
// ═══════════════════════════════════════

test.describe('Invite Flow API', () => {
  let adminToken: string;

  test.beforeEach(async ({ request }) => {
    await resetDB(request);
    await seedUser(request, ADMIN_USER);
    adminToken = await getAuthToken(request, ADMIN_USER);
  });

  test('send invite returns id, email, inviteUrl, emailSent', async ({ request }) => {
    const api = authFetch(request, adminToken);
    const res = await api.post('/api/admin/invites', { email: INVITE_EMAIL });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(body.email).toBe(INVITE_EMAIL);
    expect(body.inviteUrl).toContain('/invite/');
    expect(typeof body.emailSent).toBe('boolean');
  });

  test('send invite duplicate email returns 409', async ({ request }) => {
    const api = authFetch(request, adminToken);

    // First invite
    const res1 = await api.post('/api/admin/invites', { email: INVITE_EMAIL });
    expect(res1.status()).toBe(200);

    // Second invite same email — should get 409 suggesting resend
    const res2 = await api.post('/api/admin/invites', { email: INVITE_EMAIL });
    expect(res2.status()).toBe(409);
  });

  test('list pending invites returns sent invite', async ({ request }) => {
    const api = authFetch(request, adminToken);

    // Send an invite
    await api.post('/api/admin/invites', { email: INVITE_EMAIL });

    // List invites
    const res = await api.get('/api/admin/invites');
    expect(res.status()).toBe(200);
    const invites = await res.json();

    expect(invites.length).toBeGreaterThanOrEqual(1);
    const found = invites.find((i: any) => i.email === INVITE_EMAIL);
    expect(found).toBeDefined();
    expect(found.id).toBeDefined();
    expect(found.expiresAt).toBeDefined();
    expect(found.createdAt).toBeDefined();
  });

  test('resend invite returns new inviteUrl', async ({ request }) => {
    const api = authFetch(request, adminToken);

    // Send original invite
    const sendRes = await api.post('/api/admin/invites', { email: INVITE_EMAIL });
    const original = await sendRes.json();
    const originalToken = extractToken(original.inviteUrl);

    // Resend
    const resendRes = await api.post(`/api/admin/invites/${original.id}/resend`);
    expect(resendRes.status()).toBe(200);
    const resent = await resendRes.json();

    expect(resent.email).toBe(INVITE_EMAIL);
    expect(resent.inviteUrl).toContain('/invite/');

    // New token should be different from original
    const newToken = extractToken(resent.inviteUrl);
    expect(newToken).not.toBe(originalToken);
  });

  test('revoke invite removes it from list', async ({ request }) => {
    const api = authFetch(request, adminToken);

    // Send invite
    const sendRes = await api.post('/api/admin/invites', { email: INVITE_EMAIL });
    const { id } = await sendRes.json();

    // Revoke
    const deleteRes = await api.delete(`/api/admin/invites/${id}`);
    expect(deleteRes.status()).toBe(200);

    // Verify gone from list
    const listRes = await api.get('/api/admin/invites');
    const invites = await listRes.json();
    expect(invites.find((i: any) => i.id === id)).toBeUndefined();
  });

  test('verify valid token returns valid true and email', async ({ request }) => {
    const api = authFetch(request, adminToken);

    // Send invite
    const sendRes = await api.post('/api/admin/invites', { email: INVITE_EMAIL });
    const { inviteUrl } = await sendRes.json();
    const token = extractToken(inviteUrl);

    // Verify token (no auth required)
    const verifyRes = await request.post('/api/auth/verify-token', {
      data: { token, type: 'invite' },
    });
    expect(verifyRes.status()).toBe(200);
    const body = await verifyRes.json();
    expect(body.valid).toBe(true);
    expect(body.email).toBe(INVITE_EMAIL);
  });

  test('verify invalid token returns valid false', async ({ request }) => {
    const verifyRes = await request.post('/api/auth/verify-token', {
      data: { token: 'totally-garbage-token-12345', type: 'invite' },
    });
    expect(verifyRes.status()).toBe(200);
    const body = await verifyRes.json();
    expect(body.valid).toBe(false);
    expect(body.reason).toBe('invalid');
  });

  test('accept invite returns JWT', async ({ request }) => {
    const api = authFetch(request, adminToken);

    // Send invite
    const sendRes = await api.post('/api/admin/invites', { email: INVITE_EMAIL });
    const { inviteUrl } = await sendRes.json();
    const token = extractToken(inviteUrl);

    // Accept invite (no auth required)
    const acceptRes = await request.post('/api/auth/accept-invite', {
      data: { token, username: 'newuser', password: 'securepass99' },
    });
    expect(acceptRes.status()).toBe(200);
    const body = await acceptRes.json();
    expect(body.token).toBeTruthy();
    expect(body.role).toBeDefined();
    expect(body.enabledModules).toBeDefined();
  });

  test('accept invite creates user visible in admin user list', async ({ request }) => {
    const api = authFetch(request, adminToken);

    // Send invite
    const sendRes = await api.post('/api/admin/invites', { email: INVITE_EMAIL });
    const { inviteUrl } = await sendRes.json();
    const token = extractToken(inviteUrl);

    // Accept
    await request.post('/api/auth/accept-invite', {
      data: { token, username: 'inviteduser', password: 'securepass99' },
    });

    // Verify new user appears in admin list
    const listRes = await api.get('/api/admin/users');
    const users = await listRes.json();
    const newUser = users.find((u: any) => u.username === 'inviteduser');
    expect(newUser).toBeDefined();
    expect(newUser.email).toBe(INVITE_EMAIL);
  });

  test('accept invite with weak password is rejected', async ({ request }) => {
    const api = authFetch(request, adminToken);

    // Send invite
    const sendRes = await api.post('/api/admin/invites', { email: INVITE_EMAIL });
    const { inviteUrl } = await sendRes.json();
    const token = extractToken(inviteUrl);

    // Accept with short password (< 8 chars)
    const acceptRes = await request.post('/api/auth/accept-invite', {
      data: { token, username: 'weakpwd', password: 'short' },
    });
    expect(acceptRes.status()).toBe(400);
  });

  test('accept invite with duplicate username is rejected', async ({ request }) => {
    const api = authFetch(request, adminToken);

    // Send invite
    const sendRes = await api.post('/api/admin/invites', { email: INVITE_EMAIL });
    const { inviteUrl } = await sendRes.json();
    const token = extractToken(inviteUrl);

    // Accept with admin's username (already exists)
    const acceptRes = await request.post('/api/auth/accept-invite', {
      data: { token, username: ADMIN_USER.username, password: 'securepass99' },
    });
    expect(acceptRes.status()).toBe(409);
  });

  test('accept invite with used token fails', async ({ request }) => {
    const api = authFetch(request, adminToken);

    // Send invite
    const sendRes = await api.post('/api/admin/invites', { email: INVITE_EMAIL });
    const { inviteUrl } = await sendRes.json();
    const token = extractToken(inviteUrl);

    // First accept — should succeed
    const acceptRes1 = await request.post('/api/auth/accept-invite', {
      data: { token, username: 'firstuser', password: 'securepass99' },
    });
    expect(acceptRes1.status()).toBe(200);

    // Second accept with same token — should fail
    const acceptRes2 = await request.post('/api/auth/accept-invite', {
      data: { token, username: 'seconduser', password: 'securepass99' },
    });
    expect(acceptRes2.status()).toBe(400);
  });

  test('login with credentials created via invite', async ({ request }) => {
    const api = authFetch(request, adminToken);

    // Send invite
    const sendRes = await api.post('/api/admin/invites', { email: INVITE_EMAIL });
    const { inviteUrl } = await sendRes.json();
    const token = extractToken(inviteUrl);

    // Accept invite
    await request.post('/api/auth/accept-invite', {
      data: { token, username: 'logintest', password: 'securepass99' },
    });

    // Login with the new credentials (login uses email)
    const loginRes = await request.post('/api/auth/login', {
      data: { email: INVITE_EMAIL, password: 'securepass99' },
    });
    expect(loginRes.status()).toBe(200);
    const body = await loginRes.json();
    expect(body.token).toBeTruthy();
    expect(body.role).toBeDefined();
  });

  test('accept invite with email already registered as user is rejected', async ({ request }) => {
    const api = authFetch(request, adminToken);

    // Create a user with a specific email via admin API
    await api.post('/api/admin/users', {
      username: 'existinguser',
      password: 'pass12345',
      role: 'user',
      email: 'taken@example.com',
    });

    // Send invite to the same email
    // First, we need to work around the duplicate check on pending invites
    // Use a different email for the invite, then the user already exists check fires at accept time
    const sendRes = await api.post('/api/admin/invites', { email: 'fresh@example.com' });
    const { inviteUrl } = await sendRes.json();
    const token = extractToken(inviteUrl);

    // Manually create a user with fresh@example.com email before accepting
    await api.post('/api/admin/users', {
      username: 'blocker',
      password: 'pass12345',
      role: 'user',
      email: 'fresh@example.com',
    });

    // Accept invite — email collision should be rejected
    const acceptRes = await request.post('/api/auth/accept-invite', {
      data: { token, username: 'newperson', password: 'securepass99' },
    });
    expect(acceptRes.status()).toBe(409);
  });

  test('accept invite with revoked token fails', async ({ request }) => {
    const api = authFetch(request, adminToken);

    // Send invite
    const sendRes = await api.post('/api/admin/invites', { email: 'revoked@example.com' });
    const { inviteUrl, id } = await sendRes.json();
    const token = extractToken(inviteUrl);

    // Revoke the invite
    const deleteRes = await api.delete(`/api/admin/invites/${id}`);
    expect(deleteRes.status()).toBe(200);

    // Try to accept revoked invite — should fail
    const acceptRes = await request.post('/api/auth/accept-invite', {
      data: { token, username: 'revokeduser', password: 'securepass99' },
    });
    expect(acceptRes.status()).toBe(400);
  });

  test('invite with role and modules propagates to accepted user', async ({ request }) => {
    const api = authFetch(request, adminToken);

    // Send invite with specific role and modules
    const sendRes = await api.post('/api/admin/invites', {
      email: 'roletest@example.com',
      role: 'user',
      enabledModules: ['dashboard', 'habit-tracker'],
    });
    expect(sendRes.status()).toBe(200);
    const { inviteUrl } = await sendRes.json();
    const token = extractToken(inviteUrl);

    // Accept invite
    const acceptRes = await request.post('/api/auth/accept-invite', {
      data: { token, username: 'roleuser', password: 'securepass99' },
    });
    expect(acceptRes.status()).toBe(200);
    const body = await acceptRes.json();
    expect(body.role).toBe('user');
    expect(body.enabledModules).toBeDefined();
  });

  test('non-admin cannot access invite management APIs', async ({ request }) => {
    const api = authFetch(request, adminToken);

    // Create a normal user
    await api.post('/api/admin/users', {
      username: 'normie',
      password: 'pass12345',
      role: 'user',
      email: 'normie@example.com',
    });

    const userToken = await getAuthToken(request, { username: 'normie', password: 'pass12345', email: 'normie@example.com' });
    const userApi = authFetch(request, userToken);

    // Non-admin cannot list invites
    const listRes = await userApi.get('/api/admin/invites');
    expect(listRes.status()).toBe(403);

    // Non-admin cannot send invites
    const sendRes = await userApi.post('/api/admin/invites', { email: 'hacker@example.com' });
    expect(sendRes.status()).toBe(403);
  });
});

// ═══════════════════════════════════════
// Invite Page UI Tests
// ═══════════════════════════════════════

test.describe('Invite Page UI', () => {
  let adminToken: string;

  test.beforeEach(async ({ request }) => {
    await resetDB(request);
    await seedUser(request, ADMIN_USER);
    adminToken = await getAuthToken(request, ADMIN_USER);
  });

  test('invite page with valid token shows setup form', async ({ page, request }) => {
    const api = authFetch(request, adminToken);

    // Send invite to get a valid token
    const sendRes = await api.post('/api/admin/invites', { email: INVITE_EMAIL });
    const { inviteUrl } = await sendRes.json();
    const token = extractToken(inviteUrl);

    // Navigate to invite page
    await page.goto(`/invite/${token}`);

    // Wait for verification to complete and form to appear
    await page.waitForSelector('#username', { timeout: 10000 });

    // Verify form elements are visible
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#confirmPassword')).toBeVisible();

    // Verify email is displayed
    await expect(page.locator('.invite-email')).toContainText(INVITE_EMAIL);
  });

  test('invite page with invalid token shows error', async ({ page }) => {
    await page.goto('/invite/garbage-invalid-token');

    // Wait for verification to complete and error to appear
    await page.waitForSelector('.error-msg', { timeout: 10000 });
    await expect(page.locator('.error-msg')).toBeVisible();

    // Back to login link should be visible
    await expect(page.locator('.back-link')).toBeVisible();
  });
});
