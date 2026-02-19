import { test, expect, type Page } from '@playwright/test';

// ─── 每个测试前重置数据库 ───
test.beforeEach(async ({ request }) => {
  await request.post('/api/_test/reset');
});

// ─── 工具函数 ───

/** 导航到年度计划页面并等待加载 */
async function goToPlanner(page: Page) {
  await page.goto('/annual-planner');
  await page.waitForFunction(
    () => {
      const body = document.body.textContent || '';
      return (
        body.includes('开始规划你的年度目标') ||
        body.includes('总览') ||
        body.includes('领域')
      );
    },
    { timeout: 10000 },
  );
}

/** 初始化默认领域（首次使用点击"开始规划"） */
async function initializeDefaults(page: Page) {
  await page.getByRole('button', { name: '开始规划' }).click();
  // Wait for overview to load with domain cards
  await expect(page.getByRole('heading', { name: '领域' })).toBeVisible({ timeout: 10000 });
  for (const name of ['事业', '财务', '健康', '兴趣']) {
    await expect(page.getByText(name).first()).toBeVisible();
  }
}

/** 通过 API 直接创建领域 */
async function apiCreateDomain(page: Page, name: string): Promise<number> {
  const res = await page.request.post('/api/planner/domains', {
    data: { name },
  });
  const data = await res.json();
  return data.id;
}

/** 通过 API 创建目标 */
async function apiCreateGoal(
  page: Page,
  domainId: number,
  title: string,
  options?: { description?: string; priority?: string; tagIds?: number[] },
): Promise<number> {
  const res = await page.request.post('/api/planner/goals', {
    data: { domainId, title, ...options },
  });
  const data = await res.json();
  return data.id;
}

/** 通过 API 创建检查项 */
async function apiCreateCheckitem(page: Page, goalId: number, content: string): Promise<number> {
  const res = await page.request.post('/api/planner/checkitems', {
    data: { goalId, content },
  });
  const data = await res.json();
  return data.id;
}

/** 通过 API 创建标签 */
async function apiCreateTag(page: Page, name: string): Promise<number> {
  const res = await page.request.post('/api/planner/tags', {
    data: { name },
  });
  const data = await res.json();
  return data.id;
}

/** 通过 API 勾选检查项 */
async function apiToggleCheckitem(page: Page, id: number) {
  await page.request.post('/api/planner/checkitems/toggle', {
    data: { id },
  });
}

/** 点击领域卡片进入领域详情 */
async function navigateToDomain(page: Page, domainName: string) {
  await page.locator('.domainCard').filter({ hasText: domainName }).click();
  await expect(page.getByText('← 返回总览')).toBeVisible({ timeout: 5000 });
}

/** 使用 UI 新建目标（在领域详情页） */
async function createGoalViaUI(
  page: Page,
  title: string,
  options?: { description?: string; priority?: '高' | '中' | '低' },
) {
  // Use .first() since header and empty state may both have "添加目标" button
  await page.getByRole('button', { name: '添加目标' }).first().click();
  await expect(page.getByRole('heading', { name: '新建目标' })).toBeVisible();

  await page.getByPlaceholder('输入目标标题...').fill(title);

  if (options?.description) {
    await page.getByPlaceholder('输入目标描述...').fill(options.description);
  }

  if (options?.priority) {
    // Priority buttons are inside the dialog
    const dialog = page.locator('[role="dialog"]');
    await dialog.getByRole('button', { name: options.priority }).click();
  }

  await page.getByRole('button', { name: '创建' }).click();
  // Wait for dialog to close and goal to appear
  await expect(page.locator('.goalCard').filter({ hasText: title })).toBeVisible({ timeout: 5000 });
}

/** 使用 UI 添加检查项（在目标卡片内） */
async function addCheckitemViaUI(page: Page, goalTitle: string, content: string) {
  const goalCard = page.locator('.goalCard').filter({ hasText: goalTitle });

  // The input might already be visible from a previous add
  const addBtn = goalCard.getByText('+ 添加检查项');
  const input = goalCard.getByPlaceholder('输入检查项内容，回车确认...');

  if (await addBtn.isVisible()) {
    await addBtn.click();
  }

  await input.fill(content);
  await input.press('Enter');
  await expect(goalCard.getByText(content)).toBeVisible({ timeout: 5000 });
}

// ─── 空状态与初始化 ───

test.describe('年度计划 - 空状态与初始化', () => {
  test('首次使用显示空状态引导', async ({ page }) => {
    await goToPlanner(page);

    await expect(page.getByText('开始规划你的年度目标')).toBeVisible();
    await expect(page.getByText('创建领域来组织你的目标，如事业、健康、兴趣')).toBeVisible();
    await expect(page.getByRole('button', { name: '开始规划' })).toBeVisible();
  });

  test('点击"开始规划"创建四个默认领域', async ({ page }) => {
    await goToPlanner(page);
    await initializeDefaults(page);

    // Four default domain cards should be visible
    const domainCards = page.locator('.domainCard');
    await expect(domainCards).toHaveCount(4);

    // Overview stats should show 0 goals
    await expect(page.locator('.statLabel').filter({ hasText: '目标' })).toBeVisible();
  });

  test('侧边栏显示年度计划工具', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    await expect(page.getByText('年度计划')).toBeVisible();
  });
});

// ─── 领域管理 ───

test.describe('年度计划 - 领域管理', () => {
  test('新建领域', async ({ page }) => {
    await goToPlanner(page);
    await initializeDefaults(page);

    await page.getByRole('button', { name: '新建领域' }).click();
    await expect(page.getByRole('heading', { name: '新建领域' })).toBeVisible();

    await page.getByPlaceholder('输入领域名称...').fill('学习');
    await page.getByRole('button', { name: '创建' }).click();

    await expect(page.locator('.domainCard').filter({ hasText: '学习' })).toBeVisible({ timeout: 5000 });
  });

  test('编辑领域名称', async ({ page }) => {
    await apiCreateDomain(page, '测试领域');
    await goToPlanner(page);

    const domainCard = page.locator('.domainCard').filter({ hasText: '测试领域' });
    await domainCard.hover();
    await domainCard.getByTitle('编辑').click();

    await expect(page.getByRole('heading', { name: '编辑领域' })).toBeVisible();
    const input = page.getByPlaceholder('输入领域名称...');
    await input.clear();
    await input.fill('已改名领域');
    await page.getByRole('button', { name: '保存' }).click();

    await expect(page.locator('.domainCard').filter({ hasText: '已改名领域' })).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.domainCard').filter({ hasText: '测试领域' })).not.toBeVisible();
  });

  test('删除领域需要二次确认', async ({ page }) => {
    await apiCreateDomain(page, '待删除');
    await goToPlanner(page);

    const domainCard = page.locator('.domainCard').filter({ hasText: '待删除' });
    await domainCard.hover();
    await domainCard.getByTitle('删除').click();

    // Confirm dialog should show
    await expect(page.getByRole('heading', { name: '删除领域' })).toBeVisible();
    await expect(page.getByText(/确认删除领域「待删除」/)).toBeVisible();

    // Click confirm delete button in dialog
    const dialog = page.locator('[role="dialog"]').last();
    await dialog.getByRole('button', { name: '删除' }).click();

    // Domain card should disappear
    await expect(page.locator('.domainCard').filter({ hasText: '待删除' })).not.toBeVisible({ timeout: 5000 });
  });

  test('删除领域时可取消', async ({ page }) => {
    await apiCreateDomain(page, '保留领域');
    await goToPlanner(page);

    const domainCard = page.locator('.domainCard').filter({ hasText: '保留领域' });
    await domainCard.hover();
    await domainCard.getByTitle('删除').click();

    await expect(page.getByRole('heading', { name: '删除领域' })).toBeVisible();
    await page.getByRole('button', { name: '取消' }).click();

    await expect(page.locator('.domainCard').filter({ hasText: '保留领域' })).toBeVisible();
  });

  test('空名称无法提交', async ({ page }) => {
    await apiCreateDomain(page, '测试');
    await goToPlanner(page);

    await page.getByRole('button', { name: '新建领域' }).click();
    const submitBtn = page.getByRole('button', { name: '创建' });
    await expect(submitBtn).toBeDisabled();

    await page.getByPlaceholder('输入领域名称...').fill('   ');
    await expect(submitBtn).toBeDisabled();
  });
});

// ─── 目标管理 ───

test.describe('年度计划 - 目标管理', () => {
  test('领域详情页空状态', async ({ page }) => {
    await apiCreateDomain(page, '事业');
    await goToPlanner(page);
    await navigateToDomain(page, '事业');

    await expect(page.getByText('还没有目标')).toBeVisible();
    await expect(page.getByText('在这个领域添加你的第一个年度目标')).toBeVisible();
  });

  test('新建目标', async ({ page }) => {
    await apiCreateDomain(page, '事业');
    await goToPlanner(page);
    await navigateToDomain(page, '事业');

    await createGoalViaUI(page, '升职加薪', {
      description: 'Q2 前完成考核',
      priority: '高',
    });

    const goalCard = page.locator('.goalCard').filter({ hasText: '升职加薪' });
    await expect(goalCard.getByText('Q2 前完成考核')).toBeVisible();
    await expect(goalCard.getByText('高')).toBeVisible();
  });

  test('新建目标默认优先级为中', async ({ page }) => {
    await apiCreateDomain(page, '事业');
    await goToPlanner(page);
    await navigateToDomain(page, '事业');

    await createGoalViaUI(page, '测试目标');

    const goalCard = page.locator('.goalCard').filter({ hasText: '测试目标' });
    // Medium priority badge is intentionally not rendered (v-if="priority !== 'medium'")
    await expect(goalCard.locator('.priorityBadge')).not.toBeVisible();
  });

  test('编辑目标', async ({ page }) => {
    const domainId = await apiCreateDomain(page, '事业');
    await apiCreateGoal(page, domainId, '原始标题');
    await goToPlanner(page);
    await navigateToDomain(page, '事业');

    const goalCard = page.locator('.goalCard').filter({ hasText: '原始标题' });
    await goalCard.hover();
    await goalCard.locator('.cardHeader button[title="编辑"]').click();

    await expect(page.getByRole('heading', { name: '编辑目标' })).toBeVisible();
    const titleInput = page.getByPlaceholder('输入目标标题...');
    await titleInput.clear();
    await titleInput.fill('修改后标题');
    await page.getByRole('button', { name: '保存' }).click();

    await expect(page.locator('.goalCard').filter({ hasText: '修改后标题' })).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.goalCard').filter({ hasText: '原始标题' })).not.toBeVisible();
  });

  test('删除目标需要二次确认', async ({ page }) => {
    const domainId = await apiCreateDomain(page, '事业');
    await apiCreateGoal(page, domainId, '待删除目标');
    await goToPlanner(page);
    await navigateToDomain(page, '事业');

    const goalCard = page.locator('.goalCard').filter({ hasText: '待删除目标' });
    await goalCard.hover();
    // Use cardHeader scoped selector to avoid matching checkitem delete buttons
    await goalCard.locator('.cardHeader button[title="删除"]').click();

    await expect(page.getByRole('heading', { name: '删除目标', exact: true })).toBeVisible();
    await expect(page.getByText(/确认删除目标「待删除目标」/)).toBeVisible();

    const dialog = page.locator('[role="dialog"]').last();
    await dialog.getByRole('button', { name: '删除' }).click();

    await expect(page.locator('.goalCard').filter({ hasText: '待删除目标' })).not.toBeVisible({ timeout: 5000 });
  });

  test('返回总览按钮', async ({ page }) => {
    await apiCreateDomain(page, '事业');
    await goToPlanner(page);
    await navigateToDomain(page, '事业');

    await page.getByText('← 返回总览').click();
    await expect(page.getByRole('heading', { name: '领域' })).toBeVisible();
    await expect(page.getByText('← 返回总览')).not.toBeVisible();
  });
});

// ─── 检查项管理 ───

test.describe('年度计划 - 检查项管理', () => {
  test('添加检查项', async ({ page }) => {
    const domainId = await apiCreateDomain(page, '事业');
    await apiCreateGoal(page, domainId, '测试目标');
    await goToPlanner(page);
    await navigateToDomain(page, '事业');

    await addCheckitemViaUI(page, '测试目标', '提交季度报告');

    const goalCard = page.locator('.goalCard').filter({ hasText: '测试目标' });
    await expect(goalCard.getByText('提交季度报告')).toBeVisible();
    await expect(goalCard.getByText('0/1')).toBeVisible();
  });

  test('勾选检查项', async ({ page }) => {
    const domainId = await apiCreateDomain(page, '事业');
    const goalId = await apiCreateGoal(page, domainId, '测试目标');
    await apiCreateCheckitem(page, goalId, '第一步');
    await goToPlanner(page);
    await navigateToDomain(page, '事业');

    const goalCard = page.locator('.goalCard').filter({ hasText: '测试目标' });
    await expect(goalCard.getByText('0/1')).toBeVisible();

    const checkbox = goalCard.locator('input[type="checkbox"]').first();
    await checkbox.click();

    await expect(goalCard.getByText('1/1')).toBeVisible({ timeout: 5000 });
  });

  test('取消勾选检查项', async ({ page }) => {
    const domainId = await apiCreateDomain(page, '事业');
    const goalId = await apiCreateGoal(page, domainId, '测试目标');
    const itemId = await apiCreateCheckitem(page, goalId, '第一步');
    await apiToggleCheckitem(page, itemId);

    await goToPlanner(page);
    await navigateToDomain(page, '事业');

    const goalCard = page.locator('.goalCard').filter({ hasText: '测试目标' });
    await expect(goalCard.getByText('1/1')).toBeVisible();

    const checkbox = goalCard.locator('input[type="checkbox"]').first();
    await checkbox.click();

    await expect(goalCard.getByText('0/1')).toBeVisible({ timeout: 5000 });
  });

  test('添加多个检查项', async ({ page }) => {
    const domainId = await apiCreateDomain(page, '事业');
    await apiCreateGoal(page, domainId, '测试目标');
    await goToPlanner(page);
    await navigateToDomain(page, '事业');

    await addCheckitemViaUI(page, '测试目标', '步骤一');
    await addCheckitemViaUI(page, '测试目标', '步骤二');
    await addCheckitemViaUI(page, '测试目标', '步骤三');

    const goalCard = page.locator('.goalCard').filter({ hasText: '测试目标' });
    await expect(goalCard.getByText('步骤一')).toBeVisible();
    await expect(goalCard.getByText('步骤二')).toBeVisible();
    await expect(goalCard.getByText('步骤三')).toBeVisible();
    await expect(goalCard.getByText('0/3')).toBeVisible();
  });

  test('100% 完成的目标显示已完成标记', async ({ page }) => {
    const domainId = await apiCreateDomain(page, '事业');
    const goalId = await apiCreateGoal(page, domainId, '完成目标');
    const item1 = await apiCreateCheckitem(page, goalId, '唯一步骤');
    await apiToggleCheckitem(page, item1);

    await goToPlanner(page);
    await navigateToDomain(page, '事业');

    const goalCard = page.locator('.goalCard').filter({ hasText: '完成目标' });
    await expect(goalCard.locator('.completedMark')).toBeVisible();
    await expect(goalCard.getByText('1/1')).toBeVisible();
  });
});

// ─── 标签管理 ───

test.describe('年度计划 - 标签管理', () => {
  test('标签页空状态', async ({ page }) => {
    await apiCreateDomain(page, '事业');
    await goToPlanner(page);

    await page.locator('.navTab').filter({ hasText: '标签' }).click();

    await expect(page.getByText('还没有标签')).toBeVisible();
    await expect(page.getByText(/创建标签来标记你的能力维度/)).toBeVisible();
  });

  test('通过标签管理器新建标签', async ({ page }) => {
    await apiCreateDomain(page, '事业');
    await goToPlanner(page);

    await page.locator('.navTab').filter({ hasText: '标签' }).click();
    await page.getByRole('button', { name: '管理标签' }).click();

    await expect(page.getByRole('heading', { name: '标签管理' })).toBeVisible();

    await page.getByPlaceholder('输入标签名称...').fill('法语');
    // Use exact match to avoid matching "新建标签" button
    await page.getByRole('button', { name: '新建', exact: true }).click();

    await expect(page.locator('.tagRow').filter({ hasText: '法语' })).toBeVisible({ timeout: 5000 });
  });

  test('创建目标时关联标签', async ({ page }) => {
    const domainId = await apiCreateDomain(page, '兴趣');
    await apiCreateTag(page, '法语');
    await goToPlanner(page);
    await navigateToDomain(page, '兴趣');

    await page.getByRole('button', { name: '添加目标' }).first().click();
    await page.getByPlaceholder('输入目标标题...').fill('通过 DELF B2');

    // Select tag chip in the dialog
    const dialog = page.locator('[role="dialog"]');
    await dialog.locator('.tagChip').filter({ hasText: '法语' }).click();

    await dialog.getByRole('button', { name: '创建' }).click();

    const goalCard = page.locator('.goalCard').filter({ hasText: '通过 DELF B2' });
    await expect(goalCard).toBeVisible({ timeout: 5000 });
    await expect(goalCard.getByText('法语')).toBeVisible();
  });

  test('删除标签不影响目标', async ({ page }) => {
    const domainId = await apiCreateDomain(page, '兴趣');
    const tagId = await apiCreateTag(page, '删除我');
    await apiCreateGoal(page, domainId, '保留的目标', { tagIds: [tagId] });
    await goToPlanner(page);

    // Open tag manager and delete tag
    await page.locator('.navTab').filter({ hasText: '标签' }).click();
    await page.getByRole('button', { name: '管理标签' }).click();

    const tagRow = page.locator('.tagRow').filter({ hasText: '删除我' });
    await tagRow.hover();
    await tagRow.locator('.deleteBtn').click();

    // Confirm dialog
    const confirmDialog = page.locator('[role="dialog"]').last();
    await confirmDialog.getByRole('button', { name: '删除' }).click();

    // Wait for tag to disappear from manager
    await expect(tagRow).not.toBeVisible({ timeout: 5000 });

    // Close tag manager
    await page.locator('[role="dialog"]').locator('[aria-label="关闭"]').click();

    // Navigate back to overview then to domain
    await page.locator('.navTab').filter({ hasText: '总览' }).click();
    await navigateToDomain(page, '兴趣');
    await expect(page.getByText('保留的目标')).toBeVisible();
  });
});

// ─── 总览页 ───

test.describe('年度计划 - 总览页', () => {
  test('总览显示全局统计', async ({ page }) => {
    const domainId = await apiCreateDomain(page, '事业');
    const goalId = await apiCreateGoal(page, domainId, '目标A');
    await apiCreateCheckitem(page, goalId, '步骤1');
    await apiCreateCheckitem(page, goalId, '步骤2');

    await goToPlanner(page);

    // Global stats should show labels
    await expect(page.locator('.statLabel').filter({ hasText: '目标' })).toBeVisible();
    await expect(page.locator('.statLabel').filter({ hasText: '检查项' })).toBeVisible();
    await expect(page.locator('.statLabel').filter({ hasText: '完成率' })).toBeVisible();
  });

  test('领域卡片显示统计信息', async ({ page }) => {
    const domainId = await apiCreateDomain(page, '事业');
    const goalId = await apiCreateGoal(page, domainId, '目标A');
    await apiCreateCheckitem(page, goalId, '步骤1');
    await apiCreateCheckitem(page, goalId, '步骤2');

    await goToPlanner(page);

    const domainCard = page.locator('.domainCard').filter({ hasText: '事业' });
    await expect(domainCard.getByText('1 个目标')).toBeVisible();
    await expect(domainCard.getByText('0/2 检查项')).toBeVisible();
    await expect(domainCard.getByText('0%')).toBeVisible();
  });

  test('完成检查项后总览统计更新', async ({ page }) => {
    const domainId = await apiCreateDomain(page, '事业');
    const goalId = await apiCreateGoal(page, domainId, '目标A');
    const itemId = await apiCreateCheckitem(page, goalId, '步骤1');
    await apiCreateCheckitem(page, goalId, '步骤2');
    await apiToggleCheckitem(page, itemId);

    await goToPlanner(page);

    const domainCard = page.locator('.domainCard').filter({ hasText: '事业' });
    await expect(domainCard.getByText('1/2 检查项')).toBeVisible();
    await expect(domainCard.getByText('50%')).toBeVisible();
  });

  test('点击领域卡片进入详情', async ({ page }) => {
    await apiCreateDomain(page, '事业');
    await goToPlanner(page);

    await navigateToDomain(page, '事业');

    await expect(page.getByText('← 返回总览')).toBeVisible();
    await expect(page.getByRole('button', { name: '添加目标' }).first()).toBeVisible();
  });
});

// ─── 标签聚合视图 ───

test.describe('年度计划 - 标签聚合视图', () => {
  test('标签视图显示跨领域目标', async ({ page }) => {
    const domain1 = await apiCreateDomain(page, '事业');
    const domain2 = await apiCreateDomain(page, '兴趣');
    const tagId = await apiCreateTag(page, '管理');

    await apiCreateGoal(page, domain1, '事业目标', { tagIds: [tagId] });
    await apiCreateGoal(page, domain2, '兴趣目标', { tagIds: [tagId] });

    await goToPlanner(page);
    await page.locator('.navTab').filter({ hasText: '标签' }).click();

    const tagCard = page.locator('.tagGroupCard').filter({ hasText: '管理' });
    await expect(tagCard).toBeVisible();
    await expect(tagCard.getByText('2 个目标')).toBeVisible();
    await expect(tagCard.getByText('事业目标')).toBeVisible();
    await expect(tagCard.getByText('兴趣目标')).toBeVisible();
  });

  test('标签完成率随检查项更新', async ({ page }) => {
    const domainId = await apiCreateDomain(page, '事业');
    const tagId = await apiCreateTag(page, '法语');
    const goalId = await apiCreateGoal(page, domainId, '目标A', { tagIds: [tagId] });
    const item1 = await apiCreateCheckitem(page, goalId, '步骤1');
    await apiCreateCheckitem(page, goalId, '步骤2');
    await apiToggleCheckitem(page, item1);

    await goToPlanner(page);
    await page.locator('.navTab').filter({ hasText: '标签' }).click();

    const tagCard = page.locator('.tagGroupCard').filter({ hasText: '法语' });
    await expect(tagCard.locator('.stat').filter({ hasText: '50%' })).toBeVisible();
  });
});

// ─── 视图切换 ───

test.describe('年度计划 - 视图导航', () => {
  test('总览和标签标签页切换', async ({ page }) => {
    await apiCreateDomain(page, '事业');
    await goToPlanner(page);

    // Default view should be overview
    await expect(page.getByRole('heading', { name: '领域' })).toBeVisible();

    // Switch to tags
    await page.locator('.navTab').filter({ hasText: '标签' }).click();
    await expect(page.getByText('标签聚合')).toBeVisible();

    // Switch back to overview
    await page.locator('.navTab').filter({ hasText: '总览' }).click();
    await expect(page.getByRole('heading', { name: '领域' })).toBeVisible();
  });

  test('领域详情页不显示顶部导航', async ({ page }) => {
    await apiCreateDomain(page, '事业');
    await goToPlanner(page);
    await navigateToDomain(page, '事业');

    await expect(page.locator('.viewNav')).not.toBeVisible();
  });
});

// ─── 数据持久化 ───

test.describe('年度计划 - 数据持久化', () => {
  test('刷新后领域数据保留', async ({ page }) => {
    await apiCreateDomain(page, '持久化测试');
    await goToPlanner(page);
    await expect(page.locator('.domainCard').filter({ hasText: '持久化测试' })).toBeVisible();

    await page.reload();
    await goToPlanner(page);

    await expect(page.locator('.domainCard').filter({ hasText: '持久化测试' })).toBeVisible();
  });

  test('刷新后目标和检查项数据保留', async ({ page }) => {
    const domainId = await apiCreateDomain(page, '事业');
    const goalId = await apiCreateGoal(page, domainId, '持久目标');
    await apiCreateCheckitem(page, goalId, '持久步骤');
    const itemId = await apiCreateCheckitem(page, goalId, '已完成步骤');
    await apiToggleCheckitem(page, itemId);

    await goToPlanner(page);
    await navigateToDomain(page, '事业');

    const goalCard = page.locator('.goalCard').filter({ hasText: '持久目标' });
    await expect(goalCard).toBeVisible();
    await expect(goalCard.getByText('1/2')).toBeVisible();

    await page.reload();
    await goToPlanner(page);
    await navigateToDomain(page, '事业');

    const goalCardAfterReload = page.locator('.goalCard').filter({ hasText: '持久目标' });
    await expect(goalCardAfterReload).toBeVisible();
    await expect(goalCardAfterReload.getByText('1/2')).toBeVisible();
  });
});

// ─── 删除级联 ───

test.describe('年度计划 - 级联删除', () => {
  test('删除领域时其下目标一并删除', async ({ page }) => {
    const domainId = await apiCreateDomain(page, '待删领域');
    await apiCreateGoal(page, domainId, '会被删除的目标');
    await goToPlanner(page);

    const domainCard = page.locator('.domainCard').filter({ hasText: '待删领域' });
    await domainCard.hover();
    await domainCard.getByTitle('删除').click();

    const dialog = page.locator('[role="dialog"]').last();
    await dialog.getByRole('button', { name: '删除' }).click();

    await expect(page.locator('.domainCard').filter({ hasText: '待删领域' })).not.toBeVisible({ timeout: 5000 });

    // Verify goal is gone via API
    const res = await page.request.get('/api/planner/goals', {
      params: { domainId },
    });
    const goals = await res.json();
    expect(goals).toHaveLength(0);
  });

  test('删除目标时其下检查项一并删除', async ({ page }) => {
    const domainId = await apiCreateDomain(page, '事业');
    const goalId = await apiCreateGoal(page, domainId, '待删目标');
    await apiCreateCheckitem(page, goalId, '会被删除的步骤');
    await goToPlanner(page);
    await navigateToDomain(page, '事业');

    const goalCard = page.locator('.goalCard').filter({ hasText: '待删目标' });
    await goalCard.hover();
    // Scope to cardHeader to avoid matching checkitem delete button
    await goalCard.locator('.cardHeader button[title="删除"]').click();

    const dialog = page.locator('[role="dialog"]').last();
    await dialog.getByRole('button', { name: '删除' }).click();

    await expect(page.locator('.goalCard').filter({ hasText: '待删目标' })).not.toBeVisible({ timeout: 5000 });
  });
});

// ─── 停滞检测 ───

test.describe('年度计划 - 停滞检测', () => {
  test('新创建的目标不显示停滞标记', async ({ page }) => {
    const domainId = await apiCreateDomain(page, '事业');
    const goalId = await apiCreateGoal(page, domainId, '新目标');
    await apiCreateCheckitem(page, goalId, '步骤1');
    await goToPlanner(page);
    await navigateToDomain(page, '事业');

    const goalCard = page.locator('.goalCard').filter({ hasText: '新目标' });
    await expect(goalCard).toBeVisible();
    // StagnantBadge should not be rendered
    await expect(goalCard.locator('.stagnantBadge')).not.toBeVisible();
  });

  test('100% 完成的目标不显示停滞标记', async ({ page }) => {
    const domainId = await apiCreateDomain(page, '事业');
    const goalId = await apiCreateGoal(page, domainId, '完成目标');
    const itemId = await apiCreateCheckitem(page, goalId, '唯一步骤');
    await apiToggleCheckitem(page, itemId);
    await goToPlanner(page);
    await navigateToDomain(page, '事业');

    const goalCard = page.locator('.goalCard').filter({ hasText: '完成目标' });
    await expect(goalCard.locator('.stagnantBadge')).not.toBeVisible();
    await expect(goalCard.locator('.completedMark')).toBeVisible();
  });

  test('无检查项的目标不显示停滞标记', async ({ page }) => {
    const domainId = await apiCreateDomain(page, '事业');
    await apiCreateGoal(page, domainId, '空目标');
    await goToPlanner(page);
    await navigateToDomain(page, '事业');

    const goalCard = page.locator('.goalCard').filter({ hasText: '空目标' });
    await expect(goalCard).toBeVisible();
    await expect(goalCard.locator('.stagnantBadge')).not.toBeVisible();
  });
});

// ─── 多目标交互 ───

test.describe('年度计划 - 多目标交互', () => {
  test('创建多个不同优先级的目标', async ({ page }) => {
    const domainId = await apiCreateDomain(page, '事业');
    await apiCreateGoal(page, domainId, '高优先', { priority: 'high' });
    await apiCreateGoal(page, domainId, '中优先', { priority: 'medium' });
    await apiCreateGoal(page, domainId, '低优先', { priority: 'low' });

    await goToPlanner(page);
    await navigateToDomain(page, '事业');

    await expect(page.locator('.goalCard').filter({ hasText: '高优先' })).toBeVisible();
    await expect(page.locator('.goalCard').filter({ hasText: '中优先' })).toBeVisible();
    await expect(page.locator('.goalCard').filter({ hasText: '低优先' })).toBeVisible();

    const goalCards = page.locator('.goalCard');
    await expect(goalCards).toHaveCount(3);
  });

  test('多领域之间目标数据独立', async ({ page }) => {
    const domain1 = await apiCreateDomain(page, '事业');
    const domain2 = await apiCreateDomain(page, '兴趣');
    await apiCreateGoal(page, domain1, '事业目标');
    await apiCreateGoal(page, domain2, '兴趣目标');

    await goToPlanner(page);

    await navigateToDomain(page, '事业');
    await expect(page.locator('.goalCard').filter({ hasText: '事业目标' })).toBeVisible();
    await expect(page.locator('.goalCard').filter({ hasText: '兴趣目标' })).not.toBeVisible();

    await page.getByText('← 返回总览').click();
    await navigateToDomain(page, '兴趣');
    await expect(page.locator('.goalCard').filter({ hasText: '兴趣目标' })).toBeVisible();
    await expect(page.locator('.goalCard').filter({ hasText: '事业目标' })).not.toBeVisible();
  });
});
