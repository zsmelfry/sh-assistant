import { test, expect, type Page } from '@playwright/test';

// ─── 每个测试前重置数据库 ───
test.beforeEach(async ({ request }) => {
  await request.post('/api/_test/reset');
});

// ─── 工具函数 ───

async function waitForAppReady(page: Page) {
  await page.waitForFunction(
    () => {
      const body = document.body.textContent || '';
      return (
        body.includes('还没有习惯') ||
        body.includes('习惯列表') ||
        body.includes('工具箱')
      );
    },
    { timeout: 10000 },
  );
}

async function createHabit(page: Page, name: string, frequency: 'daily' | 'weekly' | 'monthly' = 'daily') {
  const statsLabel = {
    daily: '连续打卡天数',
    weekly: '连续完成周数',
    monthly: '连续完成月数',
  }[frequency];

  const emptyButton = page.getByRole('button', { name: '创建第一个习惯' });
  const newButton = page.getByRole('button', { name: '+ 新建' });
  await expect(emptyButton.or(newButton)).toBeVisible({ timeout: 10000 });

  if (await emptyButton.isVisible()) {
    await emptyButton.click();
  } else {
    await newButton.click();
  }

  await page.getByPlaceholder('输入习惯名称...').fill(name);
  if (frequency !== 'daily') {
    const freqLabel = { weekly: '每周', monthly: '每月' }[frequency];
    await page.getByRole('button', { name: freqLabel }).click();
  }
  await page.getByRole('button', { name: '创建', exact: true }).click();
  await expect(page.getByText(statsLabel)).toBeVisible({ timeout: 10000 });
}

// ─── 补打卡测试 ───

test.describe('Phase 1 补充 - 补打卡', () => {
  test('可对过去日期进行补打卡', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);
    await createHabit(page, '跑步');

    // 切换到上个月
    await page.getByLabel('上个月').click();
    await page.waitForTimeout(300);

    // 点击上个月的第15天
    const day15 = page.locator('[role="button"]').filter({ hasText: /^15$/ }).first();
    await day15.click();
    await page.waitForTimeout(500);

    // 验证该天显示 CheckedIn 标记
    const classes = await day15.getAttribute('class');
    expect(classes?.toLowerCase()).toContain('checkedin');

    // 切换到当月再回来，验证持久化
    await page.getByLabel('下个月').click();
    await page.waitForTimeout(300);
    await page.getByLabel('上个月').click();
    await page.waitForTimeout(300);

    const day15After = page.locator('[role="button"]').filter({ hasText: /^15$/ }).first();
    const classesAfter = await day15After.getAttribute('class');
    expect(classesAfter?.toLowerCase()).toContain('checkedin');
  });
});

// ─── 跨浏览器数据共享测试 ───

test.describe('Phase 1 补充 - 跨浏览器数据共享', () => {
  test('不同浏览器上下文共享数据', async ({ browser }) => {
    // Context A: 创建习惯并打卡
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await pageA.goto('/habit-tracker');
    await waitForAppReady(pageA);
    await createHabit(pageA, '跑步');

    // 在 Context A 打卡第5天
    const dayFive = pageA.locator('[role="button"]').filter({ hasText: /^5$/ }).first();
    await dayFive.click();
    await pageA.waitForTimeout(500);

    // Context B: 打开新上下文（模拟另一个浏览器）
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await pageB.goto('/habit-tracker');
    await waitForAppReady(pageB);

    // 验证 Context B 中可以看到"跑步"习惯
    await expect(pageB.getByText('跑步')).toBeVisible();

    // 验证 Context B 中第5天有打卡标记
    const dayFiveB = pageB.locator('[role="button"]').filter({ hasText: /^5$/ }).first();
    const classes = await dayFiveB.getAttribute('class');
    expect(classes?.toLowerCase()).toContain('checkedin');

    await contextA.close();
    await contextB.close();
  });
});

// ─── 清除缓存后数据不丢失 ───

test.describe('Phase 1 补充 - 缓存清除后数据持久化', () => {
  test('清除浏览器存储后数据仍在', async ({ page, context }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);
    await createHabit(page, '跑步');

    // 打卡第5天
    const dayFive = page.locator('[role="button"]').filter({ hasText: /^5$/ }).first();
    await dayFive.click();
    await page.waitForTimeout(500);

    // 清除所有浏览器存储
    await context.clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      indexedDB.deleteDatabase('__nuxt');
    });

    // 刷新页面
    await page.reload();
    await waitForAppReady(page);

    // 验证习惯和打卡记录仍然存在（数据在服务端）
    await expect(page.getByText('跑步')).toBeVisible();
    await expect(page.getByText('连续打卡天数')).toBeVisible({ timeout: 5000 });

    const dayFiveAfter = page.locator('[role="button"]').filter({ hasText: /^5$/ }).first();
    const classes = await dayFiveAfter.getAttribute('class');
    expect(classes?.toLowerCase()).toContain('checkedin');
  });
});

// ─── API 响应时间测试 ───

test.describe('Phase 1 补充 - API 性能', () => {
  test('API 响应时间 < 100ms', async ({ page }) => {
    const apiTimings: { url: string; duration: number }[] = [];

    // 拦截 API 请求记录时间
    page.on('requestfinished', async (request) => {
      const url = request.url();
      if (url.includes('/api/') && !url.includes('/_test/')) {
        const timing = request.timing();
        const duration = timing.responseEnd - timing.requestStart;
        apiTimings.push({ url, duration });
      }
    });

    await page.goto('/habit-tracker');
    await waitForAppReady(page);
    await createHabit(page, '跑步');

    // 打卡
    const dayFive = page.locator('[role="button"]').filter({ hasText: /^5$/ }).first();
    await dayFive.click();
    await page.waitForTimeout(500);

    // 验证所有 API 响应时间
    expect(apiTimings.length).toBeGreaterThan(0);
    for (const t of apiTimings) {
      expect(t.duration, `API ${t.url} took ${t.duration}ms`).toBeLessThan(100);
    }
  });
});

// ─── 乐观更新体验测试 ───

test.describe('Phase 1 补充 - 乐观更新', () => {
  test('打卡操作 UI 即时反馈 < 300ms', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);
    await createHabit(page, '跑步');

    const dayFive = page.locator('[role="button"]').filter({ hasText: /^5$/ }).first();

    // 记录点击前时间
    const startTime = Date.now();
    await dayFive.click();

    // 等待 UI 更新（CheckedIn class 出现）
    await expect(dayFive).toHaveClass(/checkedIn/i, { timeout: 300 });
    const endTime = Date.now();

    const uiResponseTime = endTime - startTime;
    expect(uiResponseTime, `UI response took ${uiResponseTime}ms`).toBeLessThan(300);
  });
});
