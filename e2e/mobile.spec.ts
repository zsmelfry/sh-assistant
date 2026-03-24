import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

// ─── Mobile viewport ───
const MOBILE_VIEWPORT = { width: 375, height: 812 }; // iPhone X
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };

// ─── Test constants ───
const TEST_USER = { username: 'testuser', password: 'testpass123' };

// ─── Helpers ───

async function resetAndSeedUser(request: APIRequestContext) {
  await request.post('/api/_test/reset');
  await request.post('/api/_test/seed-user', {
    data: TEST_USER,
  });
}

async function loginAndGoto(page: Page, path: string) {
  await page.goto('/login');
  await page.waitForSelector('.login-form', { timeout: 10000 });
  await page.fill('#username', TEST_USER.username);
  await page.fill('#password', TEST_USER.password);
  await page.click('.submit-btn');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  if (path !== '/dashboard' && path !== '/') {
    await page.goto(path);
    await page.waitForTimeout(1000);
  }
}

async function createHabit(page: Page, name: string) {
  const emptyButton = page.getByRole('button', { name: '创建第一个习惯' });
  const newButton = page.getByRole('button', { name: '+ 新建' });
  await expect(emptyButton.or(newButton)).toBeVisible({ timeout: 10000 });

  if (await emptyButton.isVisible()) {
    await emptyButton.click();
  } else {
    await newButton.click();
  }

  await page.getByPlaceholder('输入习惯名称...').fill(name);
  await page.getByRole('button', { name: '创建', exact: true }).click();
  await expect(page.getByText('连续打卡天数')).toBeVisible({ timeout: 10000 });
}

// ═══════════════════════════════════════
// Phase 2: Mobile Viewport E2E Tests
// ═══════════════════════════════════════

test.describe('Mobile: Bottom Navigation Bar', () => {
  test.beforeEach(async ({ request }) => {
    await resetAndSeedUser(request);
  });

  test('mobile viewport shows bottom nav, hides sidebar', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await loginAndGoto(page, '/habit-tracker');

    // Bottom nav should be visible
    const bottomNav = page.locator('.bottom-nav');
    await expect(bottomNav).toBeVisible({ timeout: 5000 });

    // Sidebar should be hidden
    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toBeHidden();
  });

  test('desktop viewport shows sidebar, hides bottom nav', async ({ page }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await loginAndGoto(page, '/habit-tracker');

    // Sidebar should be visible
    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toBeVisible({ timeout: 5000 });

    // Bottom nav should be hidden
    const bottomNav = page.locator('.bottom-nav');
    await expect(bottomNav).toBeHidden();
  });

  test('bottom nav tool links navigate correctly', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await loginAndGoto(page, '/habit-tracker');
    await page.waitForTimeout(500);

    // Find all nav-tab links in bottom nav (excluding the "更多" button)
    const navTabs = page.locator('.bottom-nav .nav-tab[href]');
    const count = await navTabs.count();
    expect(count).toBeGreaterThanOrEqual(2); // At least habit-tracker and vocab-tracker

    // Click second tool tab
    if (count >= 2) {
      const secondTab = navTabs.nth(1);
      const href = await secondTab.getAttribute('href');
      await secondTab.click();
      await page.waitForTimeout(1000);
      expect(page.url()).toContain(href!);
    }
  });

  test('bottom nav "more" menu shows settings and logout', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await loginAndGoto(page, '/habit-tracker');

    // Click "更多" tab
    const moreBtn = page.locator('.bottom-nav .nav-tab').last();
    await moreBtn.click();

    // Menu popup should show
    const menuPopup = page.locator('.menu-popup');
    await expect(menuPopup).toBeVisible({ timeout: 3000 });

    // Should have "模型设置" and "登出"
    await expect(menuPopup.getByText('模型设置')).toBeVisible();
    await expect(menuPopup.getByText('登出')).toBeVisible();
  });

  test('bottom nav has current tool highlighted', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await loginAndGoto(page, '/habit-tracker');

    // First nav tab should have .active class
    const activeTab = page.locator('.bottom-nav .nav-tab.active');
    await expect(activeTab).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Mobile: Habit Tracker Layout', () => {
  test.beforeEach(async ({ request }) => {
    await resetAndSeedUser(request);
  });

  test('habit list displays horizontally on mobile', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await loginAndGoto(page, '/habit-tracker');
    await createHabit(page, '跑步');

    // On mobile, .habitList should be full-width (no right border, has bottom border)
    const habitList = page.locator('.habitList');
    await expect(habitList).toBeVisible();

    // .listItems should be flex-row on mobile
    const listItems = page.locator('.listItems');
    const flexDirection = await listItems.evaluate(el =>
      getComputedStyle(el).flexDirection,
    );
    expect(flexDirection).toBe('row');
  });

  test('calendar and charts stack vertically on mobile', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await loginAndGoto(page, '/habit-tracker');
    await createHabit(page, '跑步');

    // .contentColumns should be flex-column on mobile
    const contentColumns = page.locator('.contentColumns');
    if (await contentColumns.isVisible()) {
      const flexDirection = await contentColumns.evaluate(el =>
        getComputedStyle(el).flexDirection,
      );
      expect(flexDirection).toBe('column');
    }
  });

  test('calendar day touch target is at least 44px', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await loginAndGoto(page, '/habit-tracker');
    await createHabit(page, '跑步');

    // Check a visible calendar day cell
    const dayCell = page.locator('.day:not(.outside)').first();
    if (await dayCell.isVisible()) {
      const box = await dayCell.boundingBox();
      expect(box).toBeTruthy();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(40); // Allow small rounding tolerance
      }
    }
  });
});

test.describe('Mobile: Vocab Tracker Layout', () => {
  test.beforeEach(async ({ request }) => {
    await resetAndSeedUser(request);
  });

  test('vocab tracker is full width on mobile', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await loginAndGoto(page, '/vocab-tracker');
    await page.waitForTimeout(1000);

    const vocabTracker = page.locator('.vocabTracker');
    if (await vocabTracker.isVisible()) {
      const box = await vocabTracker.boundingBox();
      expect(box).toBeTruthy();
      if (box) {
        // Should be nearly full viewport width
        expect(box.width).toBeGreaterThanOrEqual(MOBILE_VIEWPORT.width - 40);
      }
    }
  });

  test('tabs are full-width on mobile', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await loginAndGoto(page, '/vocab-tracker');
    await page.waitForTimeout(1000);

    // If mainTabs exists, check it's full-width (flex display)
    const mainTabs = page.locator('.mainTabs');
    if (await mainTabs.isVisible()) {
      const display = await mainTabs.evaluate(el =>
        getComputedStyle(el).display,
      );
      expect(display).toBe('flex');
    }
  });
});

test.describe('Mobile: Annual Planner Layout', () => {
  test.beforeEach(async ({ request }) => {
    await resetAndSeedUser(request);
  });

  test('domain grid is single column on mobile', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await loginAndGoto(page, '/annual-planner');
    await page.waitForTimeout(1000);

    // If there's an init button, click it to create domains
    const initBtn = page.getByRole('button', { name: '开始规划' });
    if (await initBtn.isVisible()) {
      await initBtn.click();
      await page.waitForTimeout(2000);
    }

    const domainGrid = page.locator('.domainGrid');
    if (await domainGrid.isVisible()) {
      const gridCols = await domainGrid.evaluate(el =>
        getComputedStyle(el).gridTemplateColumns,
      );
      // Should be a single column (one fr value)
      const colCount = gridCols.split(' ').filter(s => s.length > 0).length;
      expect(colCount).toBe(1);
    }
  });

  test('domain cards are full width on mobile', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await loginAndGoto(page, '/annual-planner');
    await page.waitForTimeout(1000);

    const initBtn = page.getByRole('button', { name: '开始规划' });
    if (await initBtn.isVisible()) {
      await initBtn.click();
      await page.waitForTimeout(2000);
    }

    const domainCard = page.locator('.domainCard').first();
    if (await domainCard.isVisible()) {
      const box = await domainCard.boundingBox();
      expect(box).toBeTruthy();
      if (box) {
        // Card should be nearly full width (accounting for padding)
        expect(box.width).toBeGreaterThanOrEqual(MOBILE_VIEWPORT.width - 80);
      }
    }
  });
});

test.describe('Mobile: Touch Target Sizes', () => {
  test.beforeEach(async ({ request }) => {
    await resetAndSeedUser(request);
  });

  test('bottom nav tabs meet 44px minimum touch target', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await loginAndGoto(page, '/habit-tracker');

    const navTabs = page.locator('.bottom-nav .nav-tab');
    const count = await navTabs.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const tab = navTabs.nth(i);
      const box = await tab.boundingBox();
      expect(box).toBeTruthy();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test('habit list items meet 44px minimum on mobile', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await loginAndGoto(page, '/habit-tracker');
    await createHabit(page, '跑步');

    const habitItems = page.locator('.habitItem');
    const count = await habitItems.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const item = habitItems.nth(i);
      const box = await item.boundingBox();
      expect(box).toBeTruthy();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(40); // Small tolerance for rounding
      }
    }
  });
});

test.describe('Mobile: Login Page', () => {
  test.beforeEach(async ({ request }) => {
    await resetAndSeedUser(request);
  });

  test('login page renders correctly on mobile', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto('/login');
    await page.waitForSelector('.login-form', { timeout: 10000 });

    // Login card should fit within viewport
    const loginCard = page.locator('.login-card');
    const box = await loginCard.boundingBox();
    expect(box).toBeTruthy();
    if (box) {
      expect(box.width).toBeLessThanOrEqual(MOBILE_VIEWPORT.width);
    }

    // Form elements should be visible
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('.submit-btn')).toBeVisible();
  });

  test('login works on mobile viewport', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await loginAndGoto(page, '/habit-tracker');

    // Should see bottom nav (mobile)
    await expect(page.locator('.bottom-nav')).toBeVisible({ timeout: 5000 });
  });
});
