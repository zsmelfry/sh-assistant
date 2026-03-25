import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

// ─── Test constants ───
const TEST_USER = { username: 'testuser', password: 'testpass123', email: 'testuser@test.local' };

// ─── Helpers ───

/** Reset DB and create a test user via API */
async function resetAndSeedUser(request: APIRequestContext) {
  await request.post('/api/_test/reset');

  // Seed user by calling the login-adjacent seed helper
  // The _test/reset wipes users, so we need to create one.
  // We'll use a dedicated test endpoint or insert directly.
  // Since the server auth middleware whitelists /api/_test/*, let's add a seed helper.
  // Actually, let's use the bcryptjs approach: POST to a test seed endpoint.
  // For simplicity, call the seed-user script approach via a test endpoint.
  // The easiest approach: directly POST to a test helper that creates a user.
  await request.post('/api/_test/seed-user', {
    data: TEST_USER,
  });
}

/** Login via UI and wait for redirect to home */
async function loginViaUI(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.waitForSelector('.login-form', { timeout: 10000 });
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('.submit-btn');
}

/** Login and navigate to a tool page, ensuring auth is set up */
async function loginAndGoto(page: Page, request: APIRequestContext, path: string) {
  await resetAndSeedUser(request);
  await page.goto('/login');
  await page.waitForSelector('.login-form', { timeout: 10000 });
  await page.fill('#email', TEST_USER.email);
  await page.fill('#password', TEST_USER.password);
  await page.click('.submit-btn');
  // Wait for redirect to home (first tool = dashboard)
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  if (path !== '/dashboard' && path !== '/') {
    await page.goto(path);
  }
}

// ═══════════════════════════════════════
// Phase 1: Authentication E2E Tests
// ═══════════════════════════════════════

test.describe('Authentication', () => {
  test.beforeEach(async ({ request }) => {
    await resetAndSeedUser(request);
  });

  test('unauthenticated access redirects to login page', async ({ page }) => {
    await page.goto('/habit-tracker');
    // Should redirect to login
    await page.waitForURL('**/login', { timeout: 10000 });
    await expect(page.locator('.login-title')).toHaveText('个人助手');
    await expect(page.locator('.login-subtitle')).toHaveText('请登录以继续');
  });

  test('login with correct credentials succeeds', async ({ page }) => {
    await loginViaUI(page, TEST_USER.email, TEST_USER.password);
    // Should redirect to home/first tool (dashboard)
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    // Verify app content loaded (sidebar visible on desktop viewport)
    await expect(page.locator('.sidebar')).toBeVisible({ timeout: 5000 });
  });

  test('login with wrong password shows error', async ({ page }) => {
    await loginViaUI(page, TEST_USER.email, 'wrongpassword');
    // Should stay on login page with error
    await expect(page.locator('.error-msg')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.error-msg')).toContainText('邮箱或密码错误');
    // Should still be on login page
    expect(page.url()).toContain('/login');
  });

  test('login with non-existent user shows error', async ({ page }) => {
    await loginViaUI(page, 'nonexistent@example.com', 'somepassword');
    await expect(page.locator('.error-msg')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.error-msg')).toContainText('邮箱或密码错误');
  });

  test('token persists after page reload', async ({ page }) => {
    // Login first
    await loginViaUI(page, TEST_USER.email, TEST_USER.password);
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    // Reload the page
    await page.reload();

    // Should NOT redirect to login — should stay on the app
    await page.waitForTimeout(2000);
    expect(page.url()).not.toContain('/login');
    // Verify app content is loaded (sidebar is a reliable indicator)
    await expect(page.locator('.sidebar')).toBeVisible({ timeout: 10000 });
  });

  test('API requests without token return 401', async ({ request }) => {
    const response = await request.get('/api/habits');
    expect(response.status()).toBe(401);
  });

  test('API requests with valid token succeed', async ({ request }) => {
    // Login via API to get token
    const loginRes = await request.post('/api/auth/login', {
      data: { email: TEST_USER.email, password: TEST_USER.password },
    });
    expect(loginRes.status()).toBe(200);
    const { token } = await loginRes.json();
    expect(token).toBeTruthy();

    // Use token to access protected API
    const habitsRes = await request.get('/api/habits', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(habitsRes.status()).toBe(200);
  });

  test('API requests with invalid token return 401', async ({ request }) => {
    const response = await request.get('/api/habits', {
      headers: { Authorization: 'Bearer invalid-token-string' },
    });
    expect(response.status()).toBe(401);
  });

  test('authenticated user visiting /login is redirected to home', async ({ page }) => {
    // Login first
    await loginViaUI(page, TEST_USER.email, TEST_USER.password);
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    // Try to visit login page
    await page.goto('/login');
    await page.waitForTimeout(1000);

    // Should be redirected away from login
    expect(page.url()).not.toContain('/login');
  });

  test('logout clears token and redirects to login', async ({ page }) => {
    // Login
    await loginViaUI(page, TEST_USER.email, TEST_USER.password);
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    // Click logout in sidebar
    const logoutBtn = page.locator('.logout-btn').or(page.getByTitle('登出'));
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
    } else {
      // Mobile: click "更多" menu then "登出"
      await page.getByText('更多').click();
      await page.getByText('登出').click();
    }

    // Should redirect to login
    await page.waitForURL('**/login', { timeout: 10000 });

    // Token should be cleared - trying to navigate should redirect back to login
    await page.goto('/habit-tracker');
    await page.waitForURL('**/login', { timeout: 10000 });
  });
});
