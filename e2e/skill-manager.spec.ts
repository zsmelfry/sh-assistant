import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

// ─── 认证常量 ───
const TEST_USER = { username: 'testuser', password: 'testpass123' };

// ─── 每个测试前重置数据库并创建测试用户 ───
test.beforeEach(async ({ request }) => {
  await request.post('/api/_test/reset');
  await request.post('/api/_test/seed-user', { data: TEST_USER });
});

// ─── 工具函数 ───

async function getAuthToken(request: APIRequestContext): Promise<string> {
  const res = await request.post('/api/auth/login', { data: { email: `${TEST_USER.username}@test.local`, password: TEST_USER.password } });
  const body = await res.json();
  return body.token;
}

async function authFetch(
  request: APIRequestContext,
  token: string,
  method: string,
  url: string,
  data?: Record<string, unknown>,
) {
  const options: Record<string, unknown> = {
    headers: { Authorization: `Bearer ${token}` },
  };
  if (data) options.data = data;

  switch (method) {
    case 'GET': return request.get(url, options);
    case 'POST': return request.post(url, options);
    case 'PUT': return request.put(url, options);
    case 'PATCH': return request.patch(url, options);
    case 'DELETE': return request.delete(url, options);
    default: throw new Error(`Unsupported method: ${method}`);
  }
}

/** 登录并导航到技能管理页面 */
async function loginAndGoToSkillManager(page: Page) {
  await page.goto('/login');
  await page.waitForSelector('.login-form', { timeout: 10000 });
  await page.fill('#identifier', `${TEST_USER.username}@test.local`);
  await page.fill('#password', TEST_USER.password);
  await page.click('.submit-btn');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  await page.goto('/skill-manager');
  await page.waitForFunction(
    () => {
      const body = document.body.textContent || '';
      return body.includes('技能管理') && (body.includes('暂无技能') || body.includes('创建技能'));
    },
    { timeout: 10000 },
  );
}

/** 通过 API seed startup-map 技能配置 */
async function seedSkillConfig(request: APIRequestContext, token: string) {
  return authFetch(request, token, 'POST', '/api/skill-configs/seed');
}

/** 通过 API 创建自定义技能配置 */
async function apiCreateSkillConfig(
  request: APIRequestContext,
  token: string,
  overrides: Record<string, unknown> = {},
) {
  const data = {
    skillId: 'test-skill',
    name: '测试技能',
    description: '一个测试技能',
    icon: 'BookOpen',
    teachingSystemPrompt: '你是{{skill.name}}导师',
    teachingUserPrompt: '请为"{{point.name}}"生成教学。',
    chatSystemPrompt: '你是导师。知识点：{{point.name}}',
    taskSystemPrompt: '请为{{point.name}}生成任务。',
    taskUserPrompt: '请生成任务。',
    sortOrder: 10,
    ...overrides,
  };
  const res = await authFetch(request, token, 'POST', '/api/skill-configs', data);
  expect(res.ok()).toBeTruthy();
  return res.json();
}

// ─── 技能管理 - 侧栏可见性 ───

test.describe('技能管理 - 侧栏', () => {
  test('登录后侧栏显示"技能管理"', async ({ page }) => {
    await loginAndGoToSkillManager(page);
    // 侧栏中的链接
    const navLink = page.locator('.sidebar-nav .nav-item').filter({ hasText: '技能管理' });
    await expect(navLink).toBeVisible();
  });
});

// ─── 技能管理 - 空状态 ───

test.describe('技能管理 - 空列表', () => {
  test('初始状态显示"暂无技能"', async ({ page }) => {
    await loginAndGoToSkillManager(page);
    await expect(page.locator('.emptyTitle')).toHaveText('暂无技能');
    await expect(page.locator('.emptyDesc')).toContainText('创建技能');
  });

  test('显示"创建技能"按钮', async ({ page }) => {
    await loginAndGoToSkillManager(page);
    const createBtn = page.locator('.createBtn');
    await expect(createBtn).toBeVisible();
    await expect(createBtn).toContainText('创建技能');
  });
});

// ─── 技能管理 - Seed 后列表 ───

test.describe('技能管理 - 技能列表', () => {
  test('seed 后显示 startup-map 技能卡片', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedSkillConfig(request, token);

    await loginAndGoToSkillManager(page);

    // 等待加载完成，应显示 grid
    await expect(page.locator('.grid')).toBeVisible({ timeout: 10000 });

    // 卡片中包含"创业地图"
    const card = page.locator('.card').filter({ hasText: '创业地图' });
    await expect(card).toBeVisible();

    // 卡片显示 skillId
    await expect(card.locator('.metaItem').first()).toContainText('startup-map');

    // 卡片有编辑和删除按钮
    await expect(card.locator('.actionBtn').filter({ hasText: '编辑' })).toBeVisible();
    await expect(card.locator('.actionBtn').filter({ hasText: '删除' })).toBeVisible();
  });

  test('seed 后 startup-map 出现在侧栏中', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedSkillConfig(request, token);

    await loginAndGoToSkillManager(page);

    // 等待侧栏加载 — startup-map 作为动态工具应出现在侧栏
    const sidebarLink = page.locator('.sidebar-nav .nav-item').filter({ hasText: '创业地图' });
    await expect(sidebarLink).toBeVisible({ timeout: 10000 });
  });
});

// ─── 技能管理 - 导航到技能页面 ───

test.describe('技能管理 - 导航', () => {
  test('点击侧栏中的技能链接可以导航到技能页面', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedSkillConfig(request, token);

    // seed 知识树让页面有内容
    const { SEED_DOMAINS: domains, SEED_STAGES: stages } = await import('../src/server/database/seeds/startup-map');
    await authFetch(request, token, 'POST', '/api/skills/startup-map/seed', {
      domains: domains.slice(0, 1), // 只取第一个领域以加速
      stages: [stages[0]],
    });

    await loginAndGoToSkillManager(page);

    // 点击侧栏中的 startup-map 链接
    const sidebarLink = page.locator('.sidebar-nav .nav-item').filter({ hasText: '创业地图' });
    await expect(sidebarLink).toBeVisible({ timeout: 10000 });
    await sidebarLink.click();

    // 应导航到 /startup-map
    await page.waitForURL('**/startup-map', { timeout: 10000 });

    // 页面应显示知识树内容
    await page.waitForFunction(
      () => {
        const body = document.body.textContent || '';
        return body.includes('全局视图') || body.includes('总知识点') || body.includes('还没有知识树数据');
      },
      { timeout: 10000 },
    );
  });
});

// ─── 技能管理 - 删除技能 ───

test.describe('技能管理 - 删除', () => {
  test('删除技能后从列表和侧栏中消失', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedSkillConfig(request, token);

    await loginAndGoToSkillManager(page);

    // 确认卡片存在
    const card = page.locator('.card').filter({ hasText: '创业地图' });
    await expect(card).toBeVisible({ timeout: 10000 });

    // 确认侧栏链接存在
    const sidebarLink = page.locator('.sidebar-nav .nav-item').filter({ hasText: '创业地图' });
    await expect(sidebarLink).toBeVisible({ timeout: 5000 });

    // 处理 confirm 对话框 — 自动点击确认
    page.on('dialog', async dialog => {
      await dialog.accept();
    });

    // 点击删除按钮
    await card.locator('.actionBtn.danger').click();

    // 卡片应消失
    await expect(card).not.toBeVisible({ timeout: 10000 });

    // 侧栏链接也应消失
    await expect(sidebarLink).not.toBeVisible({ timeout: 5000 });
  });

  test('API 层 — 删除后列表为空', async ({ request }) => {
    const token = await getAuthToken(request);
    await seedSkillConfig(request, token);

    // 获取配置列表
    const listRes = await authFetch(request, token, 'GET', '/api/skill-configs');
    const configs = await listRes.json();
    expect(configs.length).toBeGreaterThan(0);

    // 删除所有配置
    for (const config of configs) {
      const delRes = await authFetch(request, token, 'DELETE', `/api/skill-configs/${config.id}`);
      expect(delRes.ok()).toBeTruthy();
    }

    // 列表为空
    const emptyRes = await authFetch(request, token, 'GET', '/api/skill-configs');
    const emptyConfigs = await emptyRes.json();
    expect(emptyConfigs.length).toBe(0);
  });
});

// ─── 技能管理 - 创建向导 UI ───

test.describe('技能管理 - 创建向导', () => {
  test('点击"创建技能"打开向导对话框', async ({ page }) => {
    await loginAndGoToSkillManager(page);

    await page.locator('.createBtn').click();

    // 向导应可见
    const wizard = page.locator('.wizard');
    await expect(wizard).toBeVisible({ timeout: 5000 });

    // 标题显示"创建技能"
    await expect(wizard.locator('.wizardTitle')).toHaveText('创建技能');

    // 三个步骤指示器
    const steps = wizard.locator('.step');
    await expect(steps).toHaveCount(3);

    // 第一步为 active
    await expect(steps.nth(0)).toHaveClass(/active/);
  });

  test('向导 Step 0: 基本信息表单', async ({ page }) => {
    await loginAndGoToSkillManager(page);
    await page.locator('.createBtn').click();

    const wizard = page.locator('.wizard');
    await expect(wizard).toBeVisible({ timeout: 5000 });

    // 有名称、描述、ID 字段
    await expect(wizard.locator('#skillName')).toBeVisible();
    await expect(wizard.locator('#skillDesc')).toBeVisible();
    await expect(wizard.locator('#skillId')).toBeVisible();

    // "下一步"按钮在未填写时应 disabled
    const nextBtn = wizard.locator('.footerBtn.primary').filter({ hasText: '下一步' });
    await expect(nextBtn).toBeDisabled();

    // 填写名称和 ID
    await wizard.locator('#skillName').fill('测试技能');
    await wizard.locator('#skillId').fill('test-skill');

    // "下一步"按钮应启用
    await expect(nextBtn).toBeEnabled();
  });

  test('向导步骤导航（下一步/上一步）', async ({ page }) => {
    await loginAndGoToSkillManager(page);
    await page.locator('.createBtn').click();

    const wizard = page.locator('.wizard');
    await expect(wizard).toBeVisible({ timeout: 5000 });

    // 填写 step 0
    await wizard.locator('#skillName').fill('测试技能');
    await wizard.locator('#skillId').fill('test-skill');

    // 进入 step 1
    await wizard.locator('.footerBtn.primary').filter({ hasText: '下一步' }).click();
    const steps = wizard.locator('.step');
    await expect(steps.nth(1)).toHaveClass(/active/);

    // "AI 生成知识树"按钮可见
    await expect(wizard.locator('.actionBtn.primary')).toBeVisible();

    // 进入 step 2
    await wizard.locator('.footerBtn.primary').filter({ hasText: '下一步' }).click();
    await expect(steps.nth(2)).toHaveClass(/active/);

    // "保存"按钮可见（替代"下一步"）
    await expect(wizard.locator('.footerBtn.primary').filter({ hasText: '保存' })).toBeVisible();

    // 回到 step 1
    await wizard.locator('.footerBtn.secondary').filter({ hasText: '上一步' }).click();
    await expect(steps.nth(1)).toHaveClass(/active/);
  });

  test('关闭向导', async ({ page }) => {
    await loginAndGoToSkillManager(page);
    await page.locator('.createBtn').click();

    const wizard = page.locator('.wizard');
    await expect(wizard).toBeVisible({ timeout: 5000 });

    // 点击关闭按钮
    await wizard.locator('.closeBtn').click();

    // 向导应消失
    await expect(wizard).not.toBeVisible({ timeout: 5000 });
  });
});

// ─── 技能管理 - 多技能场景 ───

test.describe('技能管理 - 多技能', () => {
  test('多个技能配置均显示在列表中', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await apiCreateSkillConfig(request, token, {
      skillId: 'skill-a',
      name: '技能A',
      sortOrder: 1,
    });
    await apiCreateSkillConfig(request, token, {
      skillId: 'skill-b',
      name: '技能B',
      sortOrder: 2,
    });

    await loginAndGoToSkillManager(page);

    await expect(page.locator('.grid')).toBeVisible({ timeout: 10000 });
    const cards = page.locator('.card');
    await expect(cards).toHaveCount(2);

    // 两张卡片分别显示对应名称
    await expect(cards.filter({ hasText: '技能A' })).toBeVisible();
    await expect(cards.filter({ hasText: '技能B' })).toBeVisible();
  });

  test('多个活跃技能均出现在侧栏', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await apiCreateSkillConfig(request, token, {
      skillId: 'skill-a',
      name: '技能A',
      sortOrder: 1,
    });
    await apiCreateSkillConfig(request, token, {
      skillId: 'skill-b',
      name: '技能B',
      sortOrder: 2,
    });

    await loginAndGoToSkillManager(page);

    const navItems = page.locator('.sidebar-nav .nav-item');
    await expect(navItems.filter({ hasText: '技能A' })).toBeVisible({ timeout: 10000 });
    await expect(navItems.filter({ hasText: '技能B' })).toBeVisible({ timeout: 10000 });
  });
});
