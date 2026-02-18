import { test, expect, type Page } from '@playwright/test';

// ─── 每个测试前重置数据库 ───
test.beforeEach(async ({ request }) => {
  await request.post('/api/_test/reset');
});

// ─── 工具函数 ───

/** 等待应用完全加载 */
async function waitForAppReady(page: Page) {
  // 等待 loading 消失，真实内容出现
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

/** 创建一个新习惯（默认 daily 频率） */
async function createHabit(page: Page, name: string) {
  await createHabitWithFrequency(page, name, 'daily');
}

/** 创建一个指定频率的习惯 */
async function createHabitWithFrequency(
  page: Page,
  name: string,
  frequency: 'daily' | 'weekly' | 'monthly',
) {
  const frequencyLabel = { daily: '每天', weekly: '每周', monthly: '每月' }[frequency];
  const statsLabel = {
    daily: '连续打卡天数',
    weekly: '连续完成周数',
    monthly: '连续完成月数',
  }[frequency];

  // 等待两种按钮之一出现
  const emptyButton = page.getByRole('button', { name: '创建第一个习惯' });
  const newButton = page.getByRole('button', { name: '+ 新建' });

  // 等到其中一个按钮可见
  await expect(emptyButton.or(newButton)).toBeVisible({ timeout: 10000 });

  if (await emptyButton.isVisible()) {
    await emptyButton.click();
  } else {
    await newButton.click();
  }

  await page.getByPlaceholder('输入习惯名称...').fill(name);

  // 选择频率（默认是"每天"已选中，仅非 daily 时需要点击）
  if (frequency !== 'daily') {
    await page.getByRole('button', { name: frequencyLabel }).click();
  }

  await page.getByRole('button', { name: '创建', exact: true }).click();

  // 等待习惯创建完成，统计区域出现（label 视频率而定）
  await expect(page.getByText(statsLabel)).toBeVisible({ timeout: 10000 });
}

// ─── 平台框架测试 ───

test.describe('平台框架', () => {
  test('侧边栏显示工具列表，默认选中日历打卡', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // 侧边栏应该显示"工具箱"标题
    await expect(page.getByText('工具箱')).toBeVisible();

    // 应该有"日历打卡"工具项
    await expect(page.getByText('日历打卡')).toBeVisible();

    // URL 应该自动跳转到打卡工具
    await expect(page).toHaveURL(/\/habit-tracker/);
  });

  test('侧边栏折叠与展开', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // 点击折叠按钮
    await page.getByLabel('折叠侧边栏').click();

    // 折叠后"工具箱"文字应隐藏
    await expect(page.getByText('工具箱')).not.toBeVisible();

    // 点击展开
    await page.getByLabel('展开侧边栏').click();

    // 展开后"工具箱"文字恢复可见
    await expect(page.getByText('工具箱')).toBeVisible();
  });

  test('不存在的工具路径会重定向到默认工具', async ({ page }) => {
    await page.goto('/non-existent-tool');
    await waitForAppReady(page);

    // 应该重定向到默认工具（habit-tracker）
    await expect(page).toHaveURL(/\/habit-tracker/);
  });
});

// ─── 习惯管理测试 ───

test.describe('日历打卡 - 习惯管理', () => {
  test('空状态：显示引导创建界面', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);

    await expect(page.getByText('还没有习惯')).toBeVisible();
    await expect(page.getByRole('button', { name: '创建第一个习惯' })).toBeVisible();
  });

  test('创建第一个习惯', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);
    await createHabit(page, '跑步');

    // 创建后应显示习惯列表和日历
    await expect(page.getByText('跑步')).toBeVisible();
    await expect(page.getByText('习惯列表')).toBeVisible();
    await expect(page.getByText('连续打卡天数')).toBeVisible();
    await expect(page.getByText('本月完成率')).toBeVisible();
  });

  test('创建多个习惯并切换', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);

    await createHabit(page, '跑步');
    await createHabit(page, '阅读');
    await createHabit(page, '冥想');

    // 三个习惯都应该在列表中可见
    await expect(page.getByText('跑步')).toBeVisible();
    await expect(page.getByText('阅读')).toBeVisible();
    await expect(page.getByText('冥想')).toBeVisible();

    // 点击"跑步"切换
    await page.getByText('跑步').click();
    await expect(page.getByText('连续打卡天数')).toBeVisible();
  });

  test('编辑习惯名称', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);
    await createHabit(page, '跑步');

    // 点击编辑按钮
    await page.getByLabel('编辑').click();

    // 修改名称
    const input = page.getByPlaceholder('输入习惯名称...');
    await input.clear();
    await input.fill('晨跑');
    await page.getByRole('button', { name: '保存' }).click();

    // 验证名称已更新
    await expect(page.getByText('晨跑')).toBeVisible();
    await expect(page.getByText('跑步')).not.toBeVisible();
  });

  test('删除习惯需要确认对话框', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);
    await createHabit(page, '跑步');

    // 点击删除按钮
    await page.getByLabel('删除').click();

    // 确认对话框应出现
    await expect(page.getByText('删除习惯')).toBeVisible();
    await expect(page.getByText(/确定要删除「跑步」吗/)).toBeVisible();

    // 点击确认删除
    // 对话框底部的"删除"按钮（区别于列表中的删除图标）
    const dialog = page.locator('[class*="modal"], [role="dialog"]').last();
    await dialog.getByRole('button', { name: '删除' }).click();

    // 删除后回到空状态
    await expect(page.getByText('还没有习惯')).toBeVisible();
  });

  test('删除习惯时可取消', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);
    await createHabit(page, '跑步');

    await page.getByLabel('删除').click();
    await expect(page.getByText(/确定要删除「跑步」吗/)).toBeVisible();

    // 点击取消
    await page.getByRole('button', { name: '取消' }).click();

    // 习惯仍然存在
    await expect(page.getByText('跑步')).toBeVisible();
  });

  test('空名称无法提交', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);

    await page.getByRole('button', { name: '创建第一个习惯' }).click();

    const submitBtn = page.getByRole('button', { name: '创建', exact: true });
    await expect(submitBtn).toBeDisabled();

    // 输入纯空格也无法提交
    await page.getByPlaceholder('输入习惯名称...').fill('   ');
    await expect(submitBtn).toBeDisabled();
  });
});

// ─── 日历与打卡测试 ───

test.describe('日历打卡 - 日历与打卡', () => {
  test('日历显示当月及星期头', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);
    await createHabit(page, '跑步');

    // 验证星期表头
    for (const wd of ['一', '二', '三', '四', '五', '六', '日']) {
      await expect(page.getByText(wd, { exact: true }).first()).toBeVisible();
    }

    // 验证当前月份标题
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    await expect(page.getByText(`${year}年${month}月`)).toBeVisible();
  });

  test('点击日期打卡，再次点击取消', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);
    await createHabit(page, '跑步');

    // 点击日历中的第1天
    const dayCell = page.locator('[role="button"]').filter({ hasText: /^1$/ }).first();
    await dayCell.click();
    await page.waitForTimeout(500);

    // 验证打卡标记 - CSS module 哈希后类名包含 "CheckedIn"
    const classAfterCheck = await dayCell.getAttribute('class');
    expect(classAfterCheck?.toLowerCase()).toContain('checkedin');

    // 再次点击取消打卡
    await dayCell.click();
    await page.waitForTimeout(500);

    const classAfterUncheck = await dayCell.getAttribute('class');
    expect(classAfterUncheck?.toLowerCase()).not.toContain('checkedin');
  });

  test('月份切换', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);
    await createHabit(page, '跑步');

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    // 当前月
    await expect(page.getByText(`${year}年${month}月`)).toBeVisible();

    // 切到上个月
    await page.getByLabel('上个月').click();
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    await expect(page.getByText(`${prevYear}年${prevMonth}月`)).toBeVisible();

    // 切回来再切到下个月
    await page.getByLabel('下个月').click();
    await expect(page.getByText(`${year}年${month}月`)).toBeVisible();

    await page.getByLabel('下个月').click();
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    await expect(page.getByText(`${nextYear}年${nextMonth}月`)).toBeVisible();
  });

  test('统计初始为零', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);
    await createHabit(page, '跑步');

    // 连续打卡天数为 0
    const streakItem = page.locator('text=连续打卡天数').locator('..');
    await expect(streakItem).toContainText('0');

    // 本月完成率为 0%
    const rateItem = page.locator('text=本月完成率').locator('..');
    await expect(rateItem).toContainText('0%');
  });

  test('未来日期不可打卡', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);
    await createHabit(page, '跑步');

    // 切到下个月，所有日期都是未来
    await page.getByLabel('下个月').click();
    await page.waitForTimeout(300);

    // 下个月的第15天应该是 future 样式
    const futureDay = page.locator('[role="button"]').filter({ hasText: /^15$/ }).first();
    const classes = await futureDay.getAttribute('class');
    expect(classes).toContain('Future');
  });
});

// ─── 数据一致性测试 ───

test.describe('日历打卡 - 数据一致性', () => {
  test('切换习惯时日历数据正确刷新', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);

    await createHabit(page, '跑步');
    await createHabit(page, '阅读');

    // 当前选中"阅读"，对第1天打卡
    const dayOne = page.locator('[role="button"]').filter({ hasText: /^1$/ }).first();
    await dayOne.click();
    await page.waitForTimeout(500);

    // 验证阅读已打卡
    let classes = await dayOne.getAttribute('class');
    expect(classes?.toLowerCase()).toContain('checkedin');

    // 切换到"跑步"
    await page.getByText('跑步').click();
    await page.waitForTimeout(500);

    // "跑步"的第1天不应有打卡标记
    const dayOneAfterSwitch = page.locator('[role="button"]').filter({ hasText: /^1$/ }).first();
    classes = await dayOneAfterSwitch.getAttribute('class');
    expect(classes?.toLowerCase()).not.toContain('checkedin');
  });

  test('数据刷新后持久化', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);

    await createHabit(page, '跑步');

    // 打卡第1天
    const dayOne = page.locator('[role="button"]').filter({ hasText: /^1$/ }).first();
    await dayOne.click();
    await page.waitForTimeout(500);

    // 刷新页面
    await page.reload();
    await waitForAppReady(page);

    // 等待数据加载
    await expect(page.getByText('跑步')).toBeVisible();
    await expect(page.getByText('连续打卡天数')).toBeVisible({ timeout: 5000 });

    // 第1天仍然有打卡标记
    const dayOneAfterReload = page.locator('[role="button"]').filter({ hasText: /^1$/ }).first();
    const classes = await dayOneAfterReload.getAttribute('class');
    expect(classes?.toLowerCase()).toContain('checkedin');
  });

  test('删除习惯后打卡记录被清理', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);

    await createHabit(page, '跑步');

    // 打卡
    const dayOne = page.locator('[role="button"]').filter({ hasText: /^1$/ }).first();
    await dayOne.click();
    await page.waitForTimeout(500);

    // 删除习惯
    await page.getByLabel('删除').click();
    await page.waitForTimeout(200);
    // 点击确认对话框中的删除按钮
    const confirmDeleteBtn = page.getByRole('button', { name: '删除' }).last();
    await confirmDeleteBtn.click();

    // 回到空状态
    await expect(page.getByText('还没有习惯')).toBeVisible();

    // 重新创建同名习惯
    await createHabit(page, '跑步');

    // 新习惯的统计应为0
    const streakItem = page.locator('text=连续打卡天数').locator('..');
    await expect(streakItem).toContainText('0');
  });
});

// ─── UI 黑白色调验证 ───

test.describe('UI 样式 - 黑白色调', () => {
  test('页面背景色为白色', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);

    const bgColor = await page.evaluate(() =>
      getComputedStyle(document.body).backgroundColor
    );
    expect(bgColor).toMatch(/rgb\(255,\s*255,\s*255\)/);
  });

  test('主要文字颜色为深灰/黑色', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);

    const textColor = await page.evaluate(() =>
      getComputedStyle(document.body).color
    );
    // #1A1A1A = rgb(26, 26, 26)
    expect(textColor).toMatch(/rgb\(26,\s*26,\s*26\)/);
  });

  test('CSS 变量全部为黑白灰系', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);
    await createHabit(page, '跑步');

    const cssVars = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      return {
        bgPrimary: root.getPropertyValue('--color-bg-primary').trim(),
        bgSidebar: root.getPropertyValue('--color-bg-sidebar').trim(),
        textPrimary: root.getPropertyValue('--color-text-primary').trim(),
        textSecondary: root.getPropertyValue('--color-text-secondary').trim(),
        accent: root.getPropertyValue('--color-accent').trim(),
        border: root.getPropertyValue('--color-border').trim(),
      };
    });

    expect(cssVars.bgPrimary).toBe('#FFFFFF');
    expect(cssVars.bgSidebar).toBe('#FAFAFA');
    expect(cssVars.textPrimary).toBe('#1A1A1A');
    expect(cssVars.textSecondary).toBe('#666666');
    expect(cssVars.accent).toBe('#000000');
    expect(cssVars.border).toBe('#E5E5E5');
  });

  test('今日日期有加粗边框', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);
    await createHabit(page, '跑步');

    const today = new Date().getDate().toString();
    const todayCell = page.locator('[role="button"]')
      .filter({ hasText: new RegExp(`^${today}$`) })
      .first();

    const classes = await todayCell.getAttribute('class');
    expect(classes).toContain('Today');
  });
});

// ─── 打卡频率功能测试 ───

test.describe('打卡频率 - 创建不同频率的习惯', () => {
  test('创建每天频率的习惯，默认选中"每天"', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);

    await page.getByRole('button', { name: '创建第一个习惯' }).click();

    // 频率选项应全部可见
    await expect(page.getByRole('button', { name: '每天' })).toBeVisible();
    await expect(page.getByRole('button', { name: '每周' })).toBeVisible();
    await expect(page.getByRole('button', { name: '每月' })).toBeVisible();

    // "每天"应为默认选中状态（有 active class）
    const dailyBtn = page.getByRole('button', { name: '每天' });
    const dailyClasses = await dailyBtn.getAttribute('class');
    expect(dailyClasses?.toLowerCase()).toContain('active');

    // 输入名称并创建
    await page.getByPlaceholder('输入习惯名称...').fill('跑步');
    await page.getByRole('button', { name: '创建', exact: true }).click();

    // 验证频率标签显示 "日"
    await expect(page.locator('text=日').first()).toBeVisible();
    // 验证统计标签为 daily 模式
    await expect(page.getByText('连续打卡天数')).toBeVisible();
    await expect(page.getByText('本月完成率')).toBeVisible();
  });

  test('创建每周频率的习惯', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);
    await createHabitWithFrequency(page, '大扫除', 'weekly');

    // 习惯列表中应显示频率标签 "周"
    await expect(page.getByText('大扫除')).toBeVisible();
    const badge = page.locator('[class*="frequencyBadge"]').first();
    await expect(badge).toHaveText('周');

    // 统计标签应为 weekly 模式
    await expect(page.getByText('连续完成周数')).toBeVisible();
    await expect(page.getByText('本月周完成率')).toBeVisible();
  });

  test('创建每月频率的习惯', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);
    await createHabitWithFrequency(page, '月度体检', 'monthly');

    // 习惯列表中应显示频率标签 "月"
    await expect(page.getByText('月度体检')).toBeVisible();
    const badge = page.locator('[class*="frequencyBadge"]').first();
    await expect(badge).toHaveText('月');

    // 统计标签应为 monthly 模式
    await expect(page.getByText('连续完成月数')).toBeVisible();
    await expect(page.getByText('本月完成状态')).toBeVisible();

    // 月度完成率应显示"未完成"
    const rateItem = page.locator('text=本月完成状态').locator('..');
    await expect(rateItem).toContainText('未完成');
  });

  test('创建多种频率的习惯，列表中显示不同标签', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);

    await createHabitWithFrequency(page, '跑步', 'daily');
    await createHabitWithFrequency(page, '大扫除', 'weekly');
    await createHabitWithFrequency(page, '体检', 'monthly');

    // 三个习惯都应在列表中
    await expect(page.getByText('跑步')).toBeVisible();
    await expect(page.getByText('大扫除')).toBeVisible();
    await expect(page.getByText('体检')).toBeVisible();

    // 应有三种不同的频率标签
    const badges = page.locator('[class*="frequencyBadge"]');
    await expect(badges).toHaveCount(3);
  });
});

test.describe('打卡频率 - 周任务打卡', () => {
  test('周任务打卡一次后，同周其他天显示已完成背景', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);
    await createHabitWithFrequency(page, '大扫除', 'weekly');

    // 在本月第5天打卡（选择一个大概率在周中的日期，确保同周有其他天在本月内）
    const dayFive = page.locator('[role="button"]').filter({ hasText: /^5$/ }).first();
    await dayFive.click();
    await page.waitForTimeout(500);

    // 第5天应有 CheckedIn 标记
    const dayFiveClasses = await dayFive.getAttribute('class');
    expect(dayFiveClasses?.toLowerCase()).toContain('checkedin');

    // 同一周内的其他天应有 PeriodCompleted 背景（浅灰色）
    // 找到与第1天同一行（同一周）的其他日期
    // 日历的7列网格中，同一周的天数在同一行
    // 检查第1天相邻的日期是否有 periodcompleted class
    const allDays = page.locator('[role="button"]');
    const count = await allDays.count();

    let periodCompletedCount = 0;
    for (let i = 0; i < count; i++) {
      const cls = await allDays.nth(i).getAttribute('class');
      if (cls?.toLowerCase().includes('periodcompleted')) {
        periodCompletedCount++;
      }
    }
    // 周内应有其他天显示为 period completed（打卡日本身不算，它是 checkedIn）
    expect(periodCompletedCount).toBeGreaterThan(0);
  });

  test('周任务打卡后日历使用 weekly 网格样式', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);
    await createHabitWithFrequency(page, '大扫除', 'weekly');

    // 日历 grid 应有 gridWeekly class
    const grid = page.locator('[class*="grid"]').first();
    const gridClasses = await grid.getAttribute('class');
    expect(gridClasses?.toLowerCase()).toContain('weekly');
  });

  test('周任务统计：打卡后连续完成周数和周完成率更新', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);
    await createHabitWithFrequency(page, '大扫除', 'weekly');

    // 初始统计为 0
    const streakItem = page.locator('text=连续完成周数').locator('..');
    await expect(streakItem).toContainText('0');

    // 在本月第1天打卡
    const dayOne = page.locator('[role="button"]').filter({ hasText: /^1$/ }).first();
    await dayOne.click();
    await page.waitForTimeout(500);

    // 确认打卡成功（日历上显示打卡标记）
    const dayOneClasses = await dayOne.getAttribute('class');
    expect(dayOneClasses?.toLowerCase()).toContain('checkedin');

    // 刷新页面以获取最新统计数据（StatsBar 需要重新初始化才能反映变更）
    await page.reload();
    await waitForAppReady(page);
    await expect(page.getByText('连续完成周数')).toBeVisible({ timeout: 5000 });

    // 本月周完成率应 > 0%（第1天所在周已完成）
    const rateItem = page.locator('text=本月周完成率').locator('..');
    const rateText = await rateItem.textContent();
    expect(rateText).not.toContain('0%');
  });
});

test.describe('打卡频率 - 月任务打卡', () => {
  test('月任务打卡一次后显示"本月已完成 ✓"徽章', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);
    await createHabitWithFrequency(page, '月度体检', 'monthly');

    // 打卡前不应显示完成徽章
    await expect(page.getByText('本月已完成 ✓')).not.toBeVisible();

    // 在本月第1天打卡
    const dayOne = page.locator('[role="button"]').filter({ hasText: /^1$/ }).first();
    await dayOne.click();
    await page.waitForTimeout(500);

    // 应显示"本月已完成 ✓"徽章
    await expect(page.getByText('本月已完成 ✓')).toBeVisible();
  });

  test('月任务打卡后，本月其他天显示已完成背景', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);
    await createHabitWithFrequency(page, '月度体检', 'monthly');

    // 在第1天打卡
    const dayOne = page.locator('[role="button"]').filter({ hasText: /^1$/ }).first();
    await dayOne.click();
    await page.waitForTimeout(500);

    // 本月内非打卡日应有 PeriodCompleted 背景
    const allDays = page.locator('[role="button"]');
    const count = await allDays.count();
    let periodCompletedCount = 0;
    for (let i = 0; i < count; i++) {
      const cls = await allDays.nth(i).getAttribute('class');
      if (cls?.toLowerCase().includes('periodcompleted')) {
        periodCompletedCount++;
      }
    }
    // 月内大量天数应有完成背景
    expect(periodCompletedCount).toBeGreaterThan(5);
  });

  test('月任务统计：打卡后显示"已完成"和连续月数', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);
    await createHabitWithFrequency(page, '月度体检', 'monthly');

    // 初始状态为"未完成"
    const rateItem = page.locator('text=本月完成状态').locator('..');
    await expect(rateItem).toContainText('未完成');

    // 打卡
    const dayOne = page.locator('[role="button"]').filter({ hasText: /^1$/ }).first();
    await dayOne.click();
    await page.waitForTimeout(500);

    // 确认打卡成功（日历上显示打卡标记和月度完成徽章）
    const dayOneClasses = await dayOne.getAttribute('class');
    expect(dayOneClasses?.toLowerCase()).toContain('checkedin');
    await expect(page.getByText('本月已完成 ✓')).toBeVisible();

    // 刷新页面以获取最新统计数据（StatsBar 需要重新初始化才能反映变更）
    await page.reload();
    await waitForAppReady(page);
    await expect(page.getByText('连续完成月数')).toBeVisible({ timeout: 5000 });

    // 打卡后显示"已完成"
    const rateItemAfterReload = page.locator('text=本月完成状态').locator('..');
    await expect(rateItemAfterReload).toContainText('已完成');

    // 连续完成月数应为 1
    const streakItem = page.locator('text=连续完成月数').locator('..');
    await expect(streakItem).toContainText('1');
  });

  test('月任务取消打卡后，徽章和背景消失', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);
    await createHabitWithFrequency(page, '月度体检', 'monthly');

    // 打卡
    const dayOne = page.locator('[role="button"]').filter({ hasText: /^1$/ }).first();
    await dayOne.click();
    await page.waitForTimeout(500);
    await expect(page.getByText('本月已完成 ✓')).toBeVisible();

    // 取消打卡
    await dayOne.click();
    await page.waitForTimeout(500);

    // 徽章消失
    await expect(page.getByText('本月已完成 ✓')).not.toBeVisible();

    // 完成状态恢复为"未完成"
    const rateItem = page.locator('text=本月完成状态').locator('..');
    await expect(rateItem).toContainText('未完成');
  });
});

test.describe('打卡频率 - 切换习惯时统计正确切换', () => {
  test('在日/周/月习惯间切换，统计标签和数据正确更新', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);

    await createHabitWithFrequency(page, '跑步', 'daily');
    await createHabitWithFrequency(page, '大扫除', 'weekly');
    await createHabitWithFrequency(page, '体检', 'monthly');

    // 当前选中"体检"(最后创建的)
    await expect(page.getByText('连续完成月数')).toBeVisible();
    await expect(page.getByText('本月完成状态')).toBeVisible();

    // 切换到"跑步" (daily)
    await page.getByText('跑步').click();
    await page.waitForTimeout(300);
    await expect(page.getByText('连续打卡天数')).toBeVisible();
    await expect(page.getByText('本月完成率')).toBeVisible();

    // 切换到"大扫除" (weekly)
    await page.getByText('大扫除').click();
    await page.waitForTimeout(300);
    await expect(page.getByText('连续完成周数')).toBeVisible();
    await expect(page.getByText('本月周完成率')).toBeVisible();
  });
});

test.describe('打卡频率 - 编辑习惯频率', () => {
  test('编辑习惯时可以修改频率', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);
    await createHabitWithFrequency(page, '锻炼', 'daily');

    // 确认初始为 daily
    const badge = page.locator('[class*="frequencyBadge"]').first();
    await expect(badge).toHaveText('日');
    await expect(page.getByText('连续打卡天数')).toBeVisible();

    // 点击编辑
    await page.getByLabel('编辑').click();

    // 修改频率为"每周"
    await page.getByRole('button', { name: '每周' }).click();
    await page.getByRole('button', { name: '保存' }).click();
    await page.waitForTimeout(500);

    // 频率标签应变为 "周"
    await expect(badge).toHaveText('周');

    // 统计标签应切换为 weekly 模式
    await expect(page.getByText('连续完成周数')).toBeVisible();
    await expect(page.getByText('本月周完成率')).toBeVisible();
  });

  test('编辑频率为 monthly 后，打卡记录保留', async ({ page }) => {
    await page.goto('/habit-tracker');
    await waitForAppReady(page);
    await createHabitWithFrequency(page, '锻炼', 'daily');

    // 先打卡第1天
    const dayOne = page.locator('[role="button"]').filter({ hasText: /^1$/ }).first();
    await dayOne.click();
    await page.waitForTimeout(500);

    // 确认打卡成功
    let classes = await dayOne.getAttribute('class');
    expect(classes?.toLowerCase()).toContain('checkedin');

    // 编辑频率为 monthly
    await page.getByLabel('编辑').click();
    await page.getByRole('button', { name: '每月' }).click();
    await page.getByRole('button', { name: '保存' }).click();
    await page.waitForTimeout(500);

    // 原来的打卡记录应保留（第1天仍有打卡标记）
    classes = await dayOne.getAttribute('class');
    expect(classes?.toLowerCase()).toContain('checkedin');

    // 且月度完成徽章应出现
    await expect(page.getByText('本月已完成 ✓')).toBeVisible();

    // 统计显示"已完成"
    const rateItem = page.locator('text=本月完成状态').locator('..');
    await expect(rateItem).toContainText('已完成');
  });
});
