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

async function expandHistoryPanel(page: Page) {
  const toggleBtn = page.getByText('查看历史 ▾');
  await expect(toggleBtn).toBeVisible();
  await toggleBtn.click();
  await page.waitForTimeout(300);
}

// ─── 历史面板基础交互 ───

test.describe('历史图表 - 面板交互', () => {
  test('图表面板展开/折叠', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);
    await createHabit(page, '跑步');

    // 验证"查看历史"按钮可见
    const toggleBtn = page.getByText('查看历史 ▾');
    await expect(toggleBtn).toBeVisible();

    // 展开
    await toggleBtn.click();
    await page.waitForTimeout(300);

    // 热力图标题应可见
    await expect(page.getByText('年度打卡热力图')).toBeVisible();

    // 折叠
    await page.getByText('收起历史 ▴').click();
    await page.waitForTimeout(300);

    // 热力图标题应隐藏
    await expect(page.getByText('年度打卡热力图')).not.toBeVisible();
  });
});

// ─── Daily 习惯 - 年度热力图 ───

test.describe('历史图表 - Daily 热力图', () => {
  test('daily 习惯显示 7 行热力图', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);
    await createHabit(page, '跑步');
    await expandHistoryPanel(page);

    // 验证热力图容器和标题可见
    await expect(page.getByText('年度打卡热力图')).toBeVisible();

    // 验证 dailyGrid 存在，内含大量格子
    const dailyGrid = page.locator('.dailyGrid');
    await expect(dailyGrid).toBeVisible();

    // 格子总数应大于 350 (7行 × ~52列 = ~364)
    const cells = dailyGrid.locator('.cell');
    const count = await cells.count();
    expect(count).toBeGreaterThan(350);
  });

  test('打卡后热力图格子显示 filled 样式', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);
    await createHabit(page, '跑步');

    // 打卡第5天
    const dayFive = page.locator('[role="button"]').filter({ hasText: /^5$/ }).first();
    await dayFive.click();
    await page.waitForTimeout(500);

    // 展开历史面板
    await expandHistoryPanel(page);

    // 热力图中应有 filled 格子
    const filledCells = page.locator('.dailyGrid .cell.filled');
    const count = await filledCells.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('热力图格子颜色符合黑白规范', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);
    await createHabit(page, '跑步');

    // 打卡第5天
    const dayFive = page.locator('[role="button"]').filter({ hasText: /^5$/ }).first();
    await dayFive.click();
    await page.waitForTimeout(500);

    await expandHistoryPanel(page);

    // 检查 filled 格子颜色 = #1A1A1A (rgb(26,26,26))
    const filledCell = page.locator('.dailyGrid .cell.filled').first();
    const filledBg = await filledCell.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(filledBg).toMatch(/rgb\(26,\s*26,\s*26\)/);

    // 检查 empty 格子颜色 = #EAEAEA (rgb(234,234,234))
    const emptyCell = page.locator('.dailyGrid .cell:not(.filled):not(.outside)').first();
    const emptyBg = await emptyCell.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(emptyBg).toMatch(/rgb\(234,\s*234,\s*234\)/);
  });

  test('热力图 tooltip 交互', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);
    await createHabit(page, '跑步');

    // 打卡第5天
    const dayFive = page.locator('[role="button"]').filter({ hasText: /^5$/ }).first();
    await dayFive.click();
    await page.waitForTimeout(500);

    await expandHistoryPanel(page);

    // 鼠标悬停在一个格子上
    const cell = page.locator('.dailyGrid .cell').first();
    await cell.hover();
    await page.waitForTimeout(300);

    // 验证 tooltip 出现（包含日期和状态）
    const tooltip = page.locator('.tooltip');
    await expect(tooltip).toBeVisible();
    const tooltipText = await tooltip.textContent();
    // 应包含日期格式 YYYY-MM-DD
    expect(tooltipText).toMatch(/\d{4}-\d{2}-\d{2}/);
    // 应包含 "已打卡" 或 "未打卡"
    expect(tooltipText).toMatch(/已打卡|未打卡/);
  });

  test('热力图年份导航', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);
    await createHabit(page, '跑步');
    await expandHistoryPanel(page);

    const currentYear = new Date().getFullYear();
    const heatmapSection = page.locator('.heatmap');

    // 验证显示当前年份
    await expect(heatmapSection.locator('.yearLabel')).toHaveText(String(currentYear));

    // 切换到上一年（< 按钮）
    await heatmapSection.locator('.navBtn').first().click();
    await page.waitForTimeout(300);
    await expect(heatmapSection.locator('.yearLabel')).toHaveText(String(currentYear - 1));

    // 切换回当前年（> 按钮）
    await heatmapSection.locator('.navBtn').nth(1).click();
    await page.waitForTimeout(300);
    await expect(heatmapSection.locator('.yearLabel')).toHaveText(String(currentYear));
  });
});

// ─── Weekly 习惯 - 周格子视图 ───

test.describe('历史图表 - Weekly 格子视图', () => {
  test('weekly 习惯显示周完成格子视图', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);
    await createHabit(page, '大扫除', 'weekly');
    await expandHistoryPanel(page);

    // 验证标题为"年度周完成情况"
    await expect(page.getByText('年度周完成情况')).toBeVisible();

    // 验证 weeklyGrid 存在
    const weeklyGrid = page.locator('.weeklyGrid');
    await expect(weeklyGrid).toBeVisible();

    // 应有约 52 个格子
    const cells = weeklyGrid.locator('.cell');
    const count = await cells.count();
    expect(count).toBeGreaterThanOrEqual(48);
    expect(count).toBeLessThanOrEqual(53);
  });

  test('weekly 热力图 tooltip 显示周范围', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);
    await createHabit(page, '大扫除', 'weekly');
    await expandHistoryPanel(page);

    // 鼠标悬停在一个周格子上
    const cell = page.locator('.weeklyGrid .cell').first();
    await cell.hover();
    await page.waitForTimeout(300);

    // tooltip 应显示周信息
    const tooltip = page.locator('.tooltip');
    await expect(tooltip).toBeVisible();
    const tooltipText = await tooltip.textContent();
    // 应包含 "第N周" 和日期范围
    expect(tooltipText).toMatch(/第\d+周/);
    expect(tooltipText).toMatch(/已完成|未完成/);
  });
});

// ─── Monthly 习惯 - 月格子视图 ───

test.describe('历史图表 - Monthly 格子视图', () => {
  test('monthly 习惯显示 12 个月格子', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);
    await createHabit(page, '体检', 'monthly');
    await expandHistoryPanel(page);

    // 验证标题为"年度月完成情况"
    await expect(page.getByText('年度月完成情况')).toBeVisible();

    // 验证 monthlyGrid 存在
    const monthlyGrid = page.locator('.monthlyGrid');
    await expect(monthlyGrid).toBeVisible();

    // 应有 12 个格子
    const cells = monthlyGrid.locator('.cell');
    await expect(cells).toHaveCount(12);
  });

  test('monthly 习惯不显示趋势图', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);
    await createHabit(page, '体检', 'monthly');
    await expandHistoryPanel(page);

    // 月完成格子视图应可见
    await expect(page.getByText('年度月完成情况')).toBeVisible();

    // 趋势图标题不应存在
    await expect(page.getByText('月度完成率趋势')).not.toBeVisible();
  });

  test('monthly 打卡后格子显示 filled', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);
    await createHabit(page, '体检', 'monthly');

    // 打卡
    const dayFive = page.locator('[role="button"]').filter({ hasText: /^5$/ }).first();
    await dayFive.click();
    await page.waitForTimeout(500);

    await expandHistoryPanel(page);

    // 当前月对应的格子应为 filled
    const currentMonth = new Date().getMonth(); // 0-indexed
    const monthlyGrid = page.locator('.monthlyGrid');
    const cells = monthlyGrid.locator('.cell');
    const currentMonthCell = cells.nth(currentMonth);
    await expect(currentMonthCell).toHaveClass(/filled/);
  });
});

// ─── 趋势折线图 ───

test.describe('历史图表 - 趋势折线图', () => {
  test('daily 习惯显示月度完成率趋势图', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);
    await createHabit(page, '跑步');
    await expandHistoryPanel(page);

    // 验证趋势图标题
    await expect(page.getByText('月度完成率趋势')).toBeVisible();

    // 验证 SVG 趋势图容器存在
    const trendChart = page.locator('.trendChart');
    await expect(trendChart).toBeVisible();

    // 验证有 polyline 元素（折线）- 即使率为0也应存在
    const line = trendChart.locator('.line');
    await expect(line).toBeAttached();

    // 验证有 circle 元素（数据点）
    const dots = trendChart.locator('.dot');
    const dotCount = await dots.count();
    expect(dotCount).toBeGreaterThan(0);
  });

  test('趋势图折线颜色为黑色', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);
    await createHabit(page, '跑步');
    await expandHistoryPanel(page);

    // 检查折线颜色 = #1A1A1A
    const line = page.locator('.trendChart .line');
    const stroke = await line.evaluate(el => getComputedStyle(el).stroke);
    // stroke 可能是 rgb 格式
    expect(stroke).toMatch(/rgb\(26,\s*26,\s*26\)|#1[aA]1[aA]1[aA]/);
  });

  test('趋势图 tooltip 显示完成率详情', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);
    await createHabit(page, '跑步');
    await expandHistoryPanel(page);

    // 鼠标悬停在数据点上
    const dot = page.locator('.trendChart .dot').first();
    await dot.hover();
    await page.waitForTimeout(300);

    // 验证 tooltip 出现
    const tooltip = page.locator('.tooltip');
    await expect(tooltip).toBeVisible();
    const text = await tooltip.textContent();
    // 应包含 "年月: XX%"
    expect(text).toMatch(/\d{4}年\d{1,2}月/);
    expect(text).toMatch(/\d+%/);
  });

  test('weekly 习惯趋势图 tooltip 显示周数', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);
    await createHabit(page, '大扫除', 'weekly');
    await expandHistoryPanel(page);

    // 验证趋势图可见（weekly 也显示趋势图）
    await expect(page.getByText('月度完成率趋势')).toBeVisible();

    const dot = page.locator('.trendChart .dot').first();
    await dot.hover();
    await page.waitForTimeout(300);

    const tooltip = page.locator('.tooltip');
    await expect(tooltip).toBeVisible();
    const text = await tooltip.textContent();
    // weekly 的 tooltip 应显示 "周" 而非 "天"
    expect(text).toContain('周');
  });
});

// ─── 图表 CSS 变量验证 ───

test.describe('历史图表 - 黑白色调规范', () => {
  test('图表 CSS 变量符合 PRD 规范', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);
    await createHabit(page, '跑步');
    await expandHistoryPanel(page);

    const cssVars = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      return {
        chartFill: root.getPropertyValue('--color-chart-fill').trim(),
        chartEmpty: root.getPropertyValue('--color-chart-empty').trim(),
        chartBg: root.getPropertyValue('--color-chart-bg').trim(),
        chartGrid: root.getPropertyValue('--color-chart-grid').trim(),
        cellSize: root.getPropertyValue('--chart-cell-size').trim(),
        cellGap: root.getPropertyValue('--chart-cell-gap').trim(),
      };
    });

    expect(cssVars.chartFill).toBe('#1A1A1A');
    expect(cssVars.chartEmpty).toBe('#EAEAEA');
    expect(cssVars.chartBg).toBe('#F5F5F5');
    expect(cssVars.chartGrid).toBe('#E5E5E5');
    expect(cssVars.cellSize).toBe('10px');
    expect(cssVars.cellGap).toBe('2px');
  });
});

// ─── 响应式布局 ───

test.describe('历史图表 - 响应式布局', () => {
  test('桌面端 (≥768px) 完整显示', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/habit-tracker');
    await waitForAppReady(page);
    await createHabit(page, '跑步');
    await expandHistoryPanel(page);

    // 热力图和趋势图都应可见
    await expect(page.getByText('年度打卡热力图')).toBeVisible();
    await expect(page.getByText('月度完成率趋势')).toBeVisible();

    // dailyGrid 应可见
    const dailyGrid = page.locator('.dailyGrid');
    await expect(dailyGrid).toBeVisible();
  });

  test('移动端 (<768px) 热力图可水平滚动', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/habit-tracker');
    await waitForAppReady(page);
    await createHabit(page, '跑步');
    await expandHistoryPanel(page);

    // 热力图容器应有 overflow-x: auto
    const heatmap = page.locator('.heatmap');
    const overflow = await heatmap.evaluate(el => getComputedStyle(el).overflowX);
    expect(overflow).toBe('auto');
  });
});

// ─── 图表与习惯切换联动 ───

test.describe('历史图表 - 习惯切换联动', () => {
  test('切换习惯时图表正确更新', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);
    await createHabit(page, '跑步', 'daily');
    await createHabit(page, '大扫除', 'weekly');

    // 展开历史面板（当前选中"大扫除" weekly）
    await expandHistoryPanel(page);
    await expect(page.getByText('年度周完成情况')).toBeVisible();

    // 切换到"跑步" (daily)
    await page.getByText('跑步').click();
    await page.waitForTimeout(500);

    // 图表应切换为 daily 热力图
    await expect(page.getByText('年度打卡热力图')).toBeVisible();
    await expect(page.locator('.dailyGrid')).toBeVisible();

    // 切换回"大扫除" (weekly)
    await page.getByText('大扫除').click();
    await page.waitForTimeout(500);

    await expect(page.getByText('年度周完成情况')).toBeVisible();
    await expect(page.locator('.weeklyGrid')).toBeVisible();
  });
});
