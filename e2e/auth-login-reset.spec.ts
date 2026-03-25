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

// ═══════════════════════════════════════
// Login API Tests
// ═══════════════════════════════════════

test.describe('Email Login API', () => {
  test.beforeEach(async ({ request }) => {
    await resetDB(request);
    await seedUser(request, ADMIN_USER);
  });

  test('login with email + password succeeds and returns token', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      data: { email: ADMIN_EMAIL, password: ADMIN_USER.password },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.token).toBeTruthy();
    expect(body.role).toBe('admin');
    expect(body.enabledModules).toBeDefined();
    expect(Array.isArray(body.enabledModules)).toBe(true);
  });

  test('login with wrong email fails with 401', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      data: { email: 'nonexistent@test.local', password: ADMIN_USER.password },
    });
    expect(res.status()).toBe(401);
  });

  test('login with wrong password fails with 401', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      data: { email: ADMIN_EMAIL, password: 'wrongpassword99' },
    });
    expect(res.status()).toBe(401);
  });

  test('login rate limiting triggers after 5 failures', async ({ request }) => {
    // Use a unique email to avoid leaking rate limit state from other tests
    const email = 'ratelimit-login@test.local';

    // Make 5 failed login attempts
    for (let i = 0; i < 5; i++) {
      const res = await request.post('/api/auth/login', {
        data: { email, password: 'wrong' },
      });
      expect(res.status()).toBe(401);
    }

    // 6th attempt should be rate limited
    const blocked = await request.post('/api/auth/login', {
      data: { email, password: 'wrong' },
    });
    expect(blocked.status()).toBe(429);
  });
});

// ═══════════════════════════════════════
// Forgot Password API Tests
// ═══════════════════════════════════════

test.describe('Forgot Password API', () => {
  test.beforeEach(async ({ request }) => {
    await resetDB(request);
    await seedUser(request, ADMIN_USER);
  });

  test('forgot password with valid email returns 200', async ({ request }) => {
    const res = await request.post('/api/auth/forgot-password', {
      data: { email: ADMIN_EMAIL },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('forgot password with non-existent email still returns 200 (no enumeration)', async ({ request }) => {
    const res = await request.post('/api/auth/forgot-password', {
      data: { email: 'nobody@example.com' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('forgot password rate limiting triggers after 3 attempts', async ({ request }) => {
    // Use a unique email for rate limit isolation
    const email = 'ratelimit-forgot@test.local';

    // Make 3 attempts (rate limit is 3 per hour)
    for (let i = 0; i < 3; i++) {
      const res = await request.post('/api/auth/forgot-password', {
        data: { email },
      });
      expect(res.status()).toBe(200);
    }

    // 4th attempt should be rate limited
    const blocked = await request.post('/api/auth/forgot-password', {
      data: { email },
    });
    expect(blocked.status()).toBe(429);
  });
});

// ═══════════════════════════════════════
// Reset Password API Tests
// ═══════════════════════════════════════

test.describe('Reset Password API', () => {
  test.beforeEach(async ({ request }) => {
    await resetDB(request);
    await seedUser(request, ADMIN_USER);
  });

  test('full reset flow: create token → reset password → login with new password', async ({ request }) => {
    // Create reset token via test helper (returns plaintext token)
    const tokenRes = await request.post('/api/_test/create-reset-token', {
      data: { email: ADMIN_EMAIL },
    });
    expect(tokenRes.status()).toBe(200);
    const { token } = await tokenRes.json();
    expect(token).toBeTruthy();

    // Reset password
    const resetRes = await request.post('/api/auth/reset-password', {
      data: { token, password: 'newSecurePass99' },
    });
    expect(resetRes.status()).toBe(200);
    const resetBody = await resetRes.json();
    expect(resetBody.success).toBe(true);

    // Login with new password succeeds
    const loginRes = await request.post('/api/auth/login', {
      data: { email: ADMIN_EMAIL, password: 'newSecurePass99' },
    });
    expect(loginRes.status()).toBe(200);
    const loginBody = await loginRes.json();
    expect(loginBody.token).toBeTruthy();
  });

  test('reset with invalid token returns 400', async ({ request }) => {
    const res = await request.post('/api/auth/reset-password', {
      data: { token: 'totally-invalid-garbage-token', password: 'newSecurePass99' },
    });
    expect(res.status()).toBe(400);
  });

  test('reset with expired/used token returns 400', async ({ request }) => {
    // Create and use a token
    const tokenRes = await request.post('/api/_test/create-reset-token', {
      data: { email: ADMIN_EMAIL },
    });
    const { token } = await tokenRes.json();

    // Use the token
    await request.post('/api/auth/reset-password', {
      data: { token, password: 'newSecurePass99' },
    });

    // Try to use same token again — should fail
    const res = await request.post('/api/auth/reset-password', {
      data: { token, password: 'anotherPass123' },
    });
    expect(res.status()).toBe(400);
  });

  test('reset with weak password returns 400', async ({ request }) => {
    const tokenRes = await request.post('/api/_test/create-reset-token', {
      data: { email: ADMIN_EMAIL },
    });
    const { token } = await tokenRes.json();

    // Too short
    const res = await request.post('/api/auth/reset-password', {
      data: { token, password: 'short' },
    });
    expect(res.status()).toBe(400);
  });

  test('after reset, old password no longer works', async ({ request }) => {
    // Create reset token and reset password
    const tokenRes = await request.post('/api/_test/create-reset-token', {
      data: { email: ADMIN_EMAIL },
    });
    const { token } = await tokenRes.json();

    await request.post('/api/auth/reset-password', {
      data: { token, password: 'newSecurePass99' },
    });

    // Old password should fail
    const loginRes = await request.post('/api/auth/login', {
      data: { email: ADMIN_EMAIL, password: ADMIN_USER.password },
    });
    expect(loginRes.status()).toBe(401);
  });

  test('forgot-password + reset works for user created via invite (not seed)', async ({ request }) => {
    // Create admin token to send invite
    const adminToken = await getAuthToken(request, ADMIN_EMAIL, ADMIN_USER.password);
    const api = authFetch(request, adminToken);

    // Send invite and accept it
    const inviteEmail = 'invited-reset@test.com';
    const sendRes = await api.post('/api/admin/invites', { email: inviteEmail });
    const { inviteUrl } = await sendRes.json();
    const inviteToken = inviteUrl.split('/invite/').pop()!;

    await request.post('/api/auth/accept-invite', {
      data: { token: inviteToken, username: 'invitedresetter', password: 'originalpass1' },
    });

    // Now request forgot-password
    const forgotRes = await request.post('/api/auth/forgot-password', {
      data: { email: inviteEmail },
    });
    expect(forgotRes.status()).toBe(200);

    // Create reset token via test helper
    const tokenRes = await request.post('/api/_test/create-reset-token', {
      data: { email: inviteEmail },
    });
    expect(tokenRes.status()).toBe(200);
    const { token: resetToken } = await tokenRes.json();

    // Reset password
    const resetRes = await request.post('/api/auth/reset-password', {
      data: { token: resetToken, password: 'newresetpass1' },
    });
    expect(resetRes.status()).toBe(200);

    // Login with new password
    const loginRes = await request.post('/api/auth/login', {
      data: { email: inviteEmail, password: 'newresetpass1' },
    });
    expect(loginRes.status()).toBe(200);
    expect((await loginRes.json()).token).toBeTruthy();
  });

  test('after reset, tokenVersion is bumped (old JWT invalidated)', async ({ request }) => {
    // Use a separate user to avoid login rate limit interference from other tests
    const TV_USER = { username: 'tvuser', password: 'tvpass12345' };
    const TV_EMAIL = `${TV_USER.username}@test.local`;
    await seedUser(request, TV_USER);

    // Get a token with the old tokenVersion
    const oldToken = await getAuthToken(request, TV_EMAIL, TV_USER.password);
    expect(oldToken).toBeTruthy();

    // Decode old token to get tokenVersion
    const oldPayload = JSON.parse(
      Buffer.from(oldToken.split('.')[1], 'base64url').toString(),
    );
    const oldVersion = oldPayload.tokenVersion;

    // Reset password
    const tokenRes = await request.post('/api/_test/create-reset-token', {
      data: { email: TV_EMAIL },
    });
    const { token: resetToken } = await tokenRes.json();

    await request.post('/api/auth/reset-password', {
      data: { token: resetToken, password: 'newSecurePass99' },
    });

    // Login with new password to get new JWT
    const newToken = await getAuthToken(request, TV_EMAIL, 'newSecurePass99');
    const newPayload = JSON.parse(
      Buffer.from(newToken.split('.')[1], 'base64url').toString(),
    );

    // tokenVersion should have been incremented
    expect(newPayload.tokenVersion).toBe(oldVersion + 1);

    // Old JWT should be rejected (tokenVersion mismatch)
    const oldApi = authFetch(request, oldToken);
    const res = await oldApi.get('/api/dashboard/summary');
    expect(res.status()).toBe(401);
  });
});

// ═══════════════════════════════════════
// Login Page UI Tests
// ═══════════════════════════════════════

test.describe('Login Page UI', () => {
  test.beforeEach(async ({ request }) => {
    await resetDB(request);
    await seedUser(request, ADMIN_USER);
  });

  test('login page shows email field (not username)', async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('.login-form', { timeout: 10000 });

    // Should have email field
    await expect(page.locator('#email')).toBeVisible();
    // Should NOT have username field
    await expect(page.locator('#username')).not.toBeAttached();
    // Should have password field
    await expect(page.locator('#password')).toBeVisible();
  });

  test('login page has forgot password link', async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('.login-form', { timeout: 10000 });

    const forgotLink = page.locator('.forgot-link');
    await expect(forgotLink).toBeVisible();
    await expect(forgotLink).toHaveAttribute('href', '/forgot-password');
  });

  test('forgot password page: enter email shows success message', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.waitForSelector('.login-form', { timeout: 10000 });

    await page.fill('#email', ADMIN_EMAIL);
    await page.click('.submit-btn');

    // Wait for success state
    await page.waitForSelector('.success-msg', { timeout: 10000 });
    await expect(page.locator('.success-msg')).toBeVisible();
  });

  test('reset password page with invalid token shows error', async ({ page }) => {
    await page.goto('/reset-password/garbage-invalid-token');

    // Wait for error message
    await page.waitForSelector('.error-msg', { timeout: 10000 });
    await expect(page.locator('.error-msg')).toBeVisible();

    // Back to login link should be visible
    await expect(page.locator('.back-link')).toBeVisible();
  });
});

// ═══════════════════════════════════════
// Security Header Tests
// ═══════════════════════════════════════

test.describe('Security Headers on Token Pages', () => {
  test('invite page sets Cache-Control: no-store and Referrer-Policy: no-referrer', async ({ page }) => {
    const response = await page.goto('/invite/some-token');
    expect(response).not.toBeNull();
    const headers = response!.headers();
    expect(headers['cache-control']).toContain('no-store');
    expect(headers['referrer-policy']).toBe('no-referrer');
  });

  test('reset-password page sets Cache-Control: no-store and Referrer-Policy: no-referrer', async ({ page }) => {
    const response = await page.goto('/reset-password/some-token');
    expect(response).not.toBeNull();
    const headers = response!.headers();
    expect(headers['cache-control']).toContain('no-store');
    expect(headers['referrer-policy']).toBe('no-referrer');
  });

  test('normal page does NOT override Referrer-Policy to no-referrer', async ({ page }) => {
    const response = await page.goto('/login');
    expect(response).not.toBeNull();
    const headers = response!.headers();
    // Normal pages use the default policy, not no-referrer
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });
});
