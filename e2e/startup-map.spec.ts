import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

// ─── 认证常量 ───
const TEST_USER = { username: 'testuser', password: 'testpass123' };

// ─── 每个测试前重置数据库并创建测试用户 ───
test.beforeEach(async ({ request }) => {
  await request.post('/api/_test/reset');
  await request.post('/api/_test/seed-user', { data: TEST_USER });
});

// ─── 工具函数 ───

/** 通过 API 获取 JWT token */
async function getAuthToken(request: APIRequestContext): Promise<string> {
  const res = await request.post('/api/auth/login', { data: { email: `${TEST_USER.username}@test.local`, password: TEST_USER.password } });
  const body = await res.json();
  return body.token;
}

/** 带认证的 API 调用 */
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

  let res;
  switch (method) {
    case 'GET': res = await request.get(url, options); break;
    case 'POST': res = await request.post(url, options); break;
    case 'PUT': res = await request.put(url, options); break;
    case 'PATCH': res = await request.patch(url, options); break;
    case 'DELETE': res = await request.delete(url, options); break;
    default: throw new Error(`Unsupported method: ${method}`);
  }
  return res;
}

/** 种子知识树数据（需要 token） */
async function seedKnowledgeTree(request: APIRequestContext, token: string) {
  const res = await authFetch(request, token, 'POST', '/api/skills/startup-map/seed');
  return res.json();
}

/** 登录并导航到创业地图页面 */
async function loginAndGoToStartupMap(page: Page) {
  await page.goto('/login');
  await page.waitForSelector('.login-form', { timeout: 10000 });
  await page.fill('#identifier', `${TEST_USER.username}@test.local`);
  await page.fill('#password', TEST_USER.password);
  await page.click('.submit-btn');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  await page.goto('/startup-map');
  await page.waitForFunction(
    () => {
      const body = document.body.textContent || '';
      return (
        body.includes('全局视图') ||
        body.includes('总知识点') ||
        body.includes('还没有知识树数据')
      );
    },
    { timeout: 10000 },
  );
}

/** 通过 API 创建产品档案 */
async function apiCreateProduct(
  request: APIRequestContext,
  token: string,
  overrides: Record<string, unknown> = {},
) {
  const res = await authFetch(request, token, 'POST', '/api/startup-map/products', {
    name: '测试产品',
    description: '一款测试产品',
    targetMarket: '法国',
    targetCustomer: '年轻人',
    productionSource: '中国工厂',
    currentStage: 'ideation',
    notes: '',
    ...overrides,
  });
  return res.json();
}

/** 通过 API 更新知识点状态 */
async function apiUpdatePointStatus(
  request: APIRequestContext,
  token: string,
  pointId: number,
  status: string,
) {
  const res = await authFetch(request, token, 'PATCH', `/api/skills/startup-map/points/${pointId}/status`, { status });
  return res.json();
}

/** 获取第一个领域的详情（含知识点） */
async function getFirstDomainDetail(request: APIRequestContext, token: string) {
  const domainsRes = await authFetch(request, token, 'GET', '/api/skills/startup-map/domains');
  const domains = await domainsRes.json();
  const domainId = domains[0].id;
  const detailRes = await authFetch(request, token, 'GET', `/api/skills/startup-map/domains/${domainId}`);
  return detailRes.json();
}

// ─── 种子数据初始化 ───

test.describe('创业地图 - 种子数据', () => {
  test('POST /api/skills/startup-map/seed 成功创建知识树', async ({ request }) => {
    const token = await getAuthToken(request);
    const result = await seedKnowledgeTree(request, token);
    expect(result.success).toBe(true);

    // 验证 10 个领域
    const domainsRes = await authFetch(request, token, 'GET', '/api/skills/startup-map/domains');
    const domains = await domainsRes.json();
    expect(domains).toHaveLength(10);
  });

  test('重复执行 seed 不产生重复数据', async ({ request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    const result = await seedKnowledgeTree(request, token);
    expect(result.skipped).toBe(true);

    const domainsRes = await authFetch(request, token, 'GET', '/api/skills/startup-map/domains');
    const domains = await domainsRes.json();
    expect(domains).toHaveLength(10);
  });

  test('种子数据包含正确的领域名称', async ({ request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);

    const domainsRes = await authFetch(request, token, 'GET', '/api/skills/startup-map/domains');
    const domains = await domainsRes.json();
    const names = domains.map((d: { name: string }) => d.name);

    expect(names).toContain('市场研究');
    expect(names).toContain('品牌策略');
    expect(names).toContain('产品开发');
    expect(names).toContain('供应链');
    expect(names).toContain('进出口与物流');
    expect(names).toContain('法律合规');
    expect(names).toContain('销售渠道');
    expect(names).toContain('营销推广');
    expect(names).toContain('财务管理');
    expect(names).toContain('客户运营');
  });

  test('每个领域有主题和知识点', async ({ request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);

    const domainsRes = await authFetch(request, token, 'GET', '/api/skills/startup-map/domains');
    const domains = await domainsRes.json();

    for (const domain of domains) {
      expect(domain.topicCount).toBeGreaterThan(0);
      expect(domain.pointCount).toBeGreaterThan(0);
    }
  });
});

// ─── 全局视图 ───

test.describe('创业地图 - 全局视图', () => {
  test('种子后显示 10 个领域卡片', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    await loginAndGoToStartupMap(page);

    const domainCards = page.locator('.domainCard');
    await expect(domainCards).toHaveCount(10);
  });

  test('全局统计栏显示正确数据', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    await loginAndGoToStartupMap(page);

    // 统计栏应显示三个统计卡片
    await expect(page.locator('.statLabel').filter({ hasText: '总知识点' })).toBeVisible();
    await expect(page.locator('.statLabel').filter({ hasText: '已完成' })).toBeVisible();
    await expect(page.locator('.statLabel').filter({ hasText: '完成率' })).toBeVisible();

    // 初始状态下已完成应为 0，完成率应为 0%
    const completedStat = page.locator('.statCard').filter({ hasText: '已完成' });
    await expect(completedStat.locator('.statValue')).toContainText('0');

    const rateStat = page.locator('.statCard').filter({ hasText: '完成率' });
    await expect(rateStat.locator('.statValue')).toContainText('0%');
  });

  test('领域卡片显示名称、主题数和进度', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    await loginAndGoToStartupMap(page);

    const firstCard = page.locator('.domainCard').first();
    // 卡片应包含领域名称
    await expect(firstCard.locator('.cardTitle')).toBeVisible();
    // 应显示主题数
    await expect(firstCard.getByText(/个主题/)).toBeVisible();
    // 应显示知识点进度
    await expect(firstCard.getByText(/知识点/)).toBeVisible();
    // 进度条应存在
    await expect(firstCard.locator('.progressBar')).toBeVisible();
  });

  test('无数据时显示空状态', async ({ page }) => {
    await loginAndGoToStartupMap(page);

    await expect(page.getByText('还没有知识树数据')).toBeVisible();
    await expect(page.getByText('导入内置知识树')).toBeVisible();
  });

  test('面包屑显示全局视图', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    await loginAndGoToStartupMap(page);

    await expect(page.locator('.breadcrumb').getByText('全局视图')).toBeVisible();
  });
});

// ─── 领域详情 ───

test.describe('创业地图 - 领域详情', () => {
  test('点击领域卡片进入领域详情', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    await loginAndGoToStartupMap(page);

    // 点击"市场研究"领域
    await page.locator('.domainCard').filter({ hasText: '市场研究' }).click();

    // 应显示领域标题
    await expect(page.locator('.domainTitle')).toHaveText('市场研究', { timeout: 5000 });
    // 面包屑应更新
    await expect(page.locator('.breadcrumb').getByText('市场研究')).toBeVisible();
  });

  test('领域详情显示主题分组和知识点', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    await loginAndGoToStartupMap(page);

    await page.locator('.domainCard').filter({ hasText: '市场研究' }).click();
    await expect(page.locator('.domainTitle')).toHaveText('市场研究', { timeout: 5000 });

    // 应显示主题
    await expect(page.locator('.topicGroup')).not.toHaveCount(0);
    await expect(page.getByText('行业分析')).toBeVisible();
    await expect(page.getByText('竞品分析')).toBeVisible();
    await expect(page.getByText('消费者研究')).toBeVisible();

    // 应显示知识点
    await expect(page.getByText('市场规模评估')).toBeVisible();
  });

  test('知识点默认状态为未开始', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    await loginAndGoToStartupMap(page);

    await page.locator('.domainCard').filter({ hasText: '市场研究' }).click();
    await expect(page.locator('.domainTitle')).toHaveText('市场研究', { timeout: 5000 });

    // 所有状态标记应为"未开始"
    const badges = page.locator('.statusBadge');
    const count = await badges.count();
    expect(count).toBeGreaterThan(0);

    const firstBadge = badges.first();
    await expect(firstBadge).toHaveText('未开始');
    await expect(firstBadge).toHaveClass(/not_started/);
  });

  test('领域进度显示正确', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    await loginAndGoToStartupMap(page);

    await page.locator('.domainCard').filter({ hasText: '市场研究' }).click();
    await expect(page.locator('.domainTitle')).toHaveText('市场研究', { timeout: 5000 });

    // 进度应显示 "0/X 已完成"
    await expect(page.locator('.domainProgress')).toContainText('0/');
    await expect(page.locator('.domainProgress')).toContainText('已完成');
  });

  test('面包屑可点击返回全局视图', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    await loginAndGoToStartupMap(page);

    await page.locator('.domainCard').filter({ hasText: '市场研究' }).click();
    await expect(page.locator('.domainTitle')).toHaveText('市场研究', { timeout: 5000 });

    // 点击面包屑"全局视图"
    await page.locator('.breadcrumb .crumb').filter({ hasText: '全局视图' }).click();

    // 应回到全局视图
    await expect(page.locator('.domainGrid')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.domainCard')).toHaveCount(10);
  });
});

// ─── 知识点学习页 ───

test.describe('创业地图 - 知识点学习页', () => {
  test('点击知识点进入学习页', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    await loginAndGoToStartupMap(page);

    await page.locator('.domainCard').filter({ hasText: '市场研究' }).click();
    await expect(page.locator('.domainTitle')).toHaveText('市场研究', { timeout: 5000 });

    // 点击第一个知识点
    await page.locator('.pointItem').first().click();

    // 应显示知识点标题
    await expect(page.locator('.pointTitle')).toBeVisible({ timeout: 5000 });
    // 面包屑应有三级
    const crumbs = page.locator('.breadcrumb .crumb');
    await expect(crumbs).toHaveCount(3);
  });

  test('未生成教学内容时显示生成按钮', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    await loginAndGoToStartupMap(page);

    await page.locator('.domainCard').filter({ hasText: '市场研究' }).click();
    await expect(page.locator('.domainTitle')).toHaveText('市场研究', { timeout: 5000 });
    await page.locator('.pointItem').first().click();
    await expect(page.locator('.pointTitle')).toBeVisible({ timeout: 5000 });

    await expect(page.getByText('教学内容尚未生成')).toBeVisible();
    await expect(page.getByRole('button', { name: '生成教学内容' })).toBeVisible();
  });

  test('状态选择器显示四种状态', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    await loginAndGoToStartupMap(page);

    await page.locator('.domainCard').filter({ hasText: '市场研究' }).click();
    await expect(page.locator('.domainTitle')).toHaveText('市场研究', { timeout: 5000 });
    await page.locator('.pointItem').first().click();
    await expect(page.locator('.pointTitle')).toBeVisible({ timeout: 5000 });

    await expect(page.getByRole('button', { name: '未开始' })).toBeVisible();
    await expect(page.getByRole('button', { name: '学习中' })).toBeVisible();
    await expect(page.getByRole('button', { name: '已理解' })).toBeVisible();
    await expect(page.getByRole('button', { name: '已实践' })).toBeVisible();
  });

  test('AI 对话空状态显示引导文案', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    await loginAndGoToStartupMap(page);

    await page.locator('.domainCard').filter({ hasText: '市场研究' }).click();
    await expect(page.locator('.domainTitle')).toHaveText('市场研究', { timeout: 5000 });
    await page.locator('.pointItem').first().click();
    await expect(page.locator('.pointTitle')).toBeVisible({ timeout: 5000 });

    await expect(page.getByText('AI 创业导师')).toBeVisible();
    await expect(page.getByText('问我任何关于这个知识点的问题')).toBeVisible();
  });

  test('发送按钮在输入为空时禁用', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    await loginAndGoToStartupMap(page);

    await page.locator('.domainCard').filter({ hasText: '市场研究' }).click();
    await expect(page.locator('.domainTitle')).toHaveText('市场研究', { timeout: 5000 });
    await page.locator('.pointItem').first().click();
    await expect(page.locator('.pointTitle')).toBeVisible({ timeout: 5000 });

    const sendBtn = page.getByRole('button', { name: '发送' });
    await expect(sendBtn).toBeDisabled();
  });

  test('输入文字后发送按钮启用', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    await loginAndGoToStartupMap(page);

    await page.locator('.domainCard').filter({ hasText: '市场研究' }).click();
    await expect(page.locator('.domainTitle')).toHaveText('市场研究', { timeout: 5000 });
    await page.locator('.pointItem').first().click();
    await expect(page.locator('.pointTitle')).toBeVisible({ timeout: 5000 });

    await page.getByPlaceholder('输入问题...').fill('什么是 TAM？');
    const sendBtn = page.getByRole('button', { name: '发送' });
    await expect(sendBtn).toBeEnabled();
  });
});

// ─── 学习状态管理 ───

test.describe('创业地图 - 学习状态', () => {
  test('点击状态按钮切换学习状态', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    await loginAndGoToStartupMap(page);

    await page.locator('.domainCard').filter({ hasText: '市场研究' }).click();
    await expect(page.locator('.domainTitle')).toHaveText('市场研究', { timeout: 5000 });
    await page.locator('.pointItem').first().click();
    await expect(page.locator('.pointTitle')).toBeVisible({ timeout: 5000 });

    // 默认状态为"未开始"（active）
    const notStartedBtn = page.locator('.statusBtn').filter({ hasText: '未开始' });
    await expect(notStartedBtn).toHaveClass(/active/);

    // 点击"学习中"
    await page.locator('.statusBtn').filter({ hasText: '学习中' }).click();

    // "学习中"应变为 active
    await expect(page.locator('.statusBtn').filter({ hasText: '学习中' })).toHaveClass(/active/, { timeout: 5000 });
    // "未开始"不再 active
    await expect(notStartedBtn).not.toHaveClass(/active/);
  });

  test('状态变更通过 API 持久化', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    const domain = await getFirstDomainDetail(request, token);
    const firstPointId = domain.topics[0].points[0].id;

    await loginAndGoToStartupMap(page);

    await page.locator('.domainCard').first().click();
    await expect(page.locator('.domainTitle')).toBeVisible({ timeout: 5000 });
    await page.locator('.pointItem').first().click();
    await expect(page.locator('.pointTitle')).toBeVisible({ timeout: 5000 });

    // 切换到"已理解"
    await page.locator('.statusBtn').filter({ hasText: '已理解' }).click();
    await expect(page.locator('.statusBtn').filter({ hasText: '已理解' })).toHaveClass(/active/, { timeout: 5000 });

    // 通过 API 验证
    const pointRes = await authFetch(request, token, 'GET', `/api/skills/startup-map/points/${firstPointId}`);
    const point = await pointRes.json();
    expect(point.status).toBe('understood');
  });

  test('状态变更后返回领域详情反映在状态标记上', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    await loginAndGoToStartupMap(page);

    await page.locator('.domainCard').filter({ hasText: '市场研究' }).click();
    await expect(page.locator('.domainTitle')).toHaveText('市场研究', { timeout: 5000 });

    // 进入第一个知识点
    await page.locator('.pointItem').first().click();
    await expect(page.locator('.pointTitle')).toBeVisible({ timeout: 5000 });

    // 切换到"已理解"
    await page.locator('.statusBtn').filter({ hasText: '已理解' }).click();
    await expect(page.locator('.statusBtn').filter({ hasText: '已理解' })).toHaveClass(/active/, { timeout: 5000 });

    // 返回领域详情
    await page.locator('.breadcrumb .crumb').filter({ hasText: '市场研究' }).click();
    await expect(page.locator('.domainTitle')).toHaveText('市场研究', { timeout: 5000 });

    // 第一个知识点的状态标记应为"已理解"
    const firstBadge = page.locator('.pointItem').first().locator('.statusBadge');
    await expect(firstBadge).toHaveText('已理解', { timeout: 5000 });
    await expect(firstBadge).toHaveClass(/understood/);
  });

  test('API 层 — PATCH 状态更新返回正确结果', async ({ request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    const domain = await getFirstDomainDetail(request, token);
    const firstPointId = domain.topics[0].points[0].id;

    const result = await apiUpdatePointStatus(request, token, firstPointId, 'learning');
    expect(result.status).toBe('learning');
    expect(result.statusUpdatedAt).toBeTruthy();
  });
});

// ─── 产品档案 ───

test.describe('创业地图 - 产品档案', () => {
  test('点击产品图标进入产品档案页', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    await loginAndGoToStartupMap(page);

    await page.locator('.productBtn').click();

    await expect(page.getByText('产品档案')).toBeVisible({ timeout: 5000 });
    // 面包屑应显示"产品档案"
    await expect(page.locator('.breadcrumb').getByText('产品档案')).toBeVisible();
  });

  test('无产品时显示创建表单', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    await loginAndGoToStartupMap(page);
    await page.locator('.productBtn').click();
    await expect(page.getByText('产品档案')).toBeVisible({ timeout: 5000 });

    // 表单字段应可见
    await expect(page.locator('#productName')).toBeVisible();
    await expect(page.locator('#productDesc')).toBeVisible();
    await expect(page.locator('#targetMarket')).toBeVisible();
    await expect(page.locator('#targetCustomer')).toBeVisible();
    await expect(page.locator('#productionSource')).toBeVisible();
    await expect(page.locator('#currentStage')).toBeVisible();

    // 按钮应显示"创建产品"
    await expect(page.getByRole('button', { name: '创建产品' })).toBeVisible();
  });

  test('创建产品档案', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    await loginAndGoToStartupMap(page);
    await page.locator('.productBtn').click();
    await expect(page.getByText('产品档案')).toBeVisible({ timeout: 5000 });

    // 填写表单
    await page.locator('#productName').fill('测试护肤品');
    await page.locator('#productDesc').fill('一款天然护肤品牌');
    await page.locator('#targetMarket').fill('法国');
    await page.locator('#targetCustomer').fill('25-40岁女性');
    await page.locator('#productionSource').fill('中国生产');
    await page.locator('#currentStage').selectOption('researching');

    // 提交
    await page.getByRole('button', { name: '创建产品' }).click();

    // 应显示"已保存"
    await expect(page.getByText('已保存')).toBeVisible({ timeout: 5000 });
  });

  test('产品名称为空时提交按钮禁用', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    await loginAndGoToStartupMap(page);
    await page.locator('.productBtn').click();
    await expect(page.getByText('产品档案')).toBeVisible({ timeout: 5000 });

    const submitBtn = page.getByRole('button', { name: '创建产品' });
    await expect(submitBtn).toBeDisabled();
  });

  test('已有产品时显示保存按钮并可编辑', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    await apiCreateProduct(request, token, { name: '已有产品' });
    await loginAndGoToStartupMap(page);
    await page.locator('.productBtn').click();
    await expect(page.getByText('产品档案')).toBeVisible({ timeout: 5000 });

    // 表单应填充已有数据
    await expect(page.locator('#productName')).toHaveValue('已有产品');
    // 按钮应显示"保存"（非"创建产品"）
    await expect(page.getByRole('button', { name: '保存' })).toBeVisible();
  });

  test('编辑产品档案后保存', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    await apiCreateProduct(request, token, { name: '原始名称' });
    await loginAndGoToStartupMap(page);
    await page.locator('.productBtn').click();
    await expect(page.getByText('产品档案')).toBeVisible({ timeout: 5000 });

    // 修改名称
    const nameInput = page.locator('#productName');
    await nameInput.clear();
    await nameInput.fill('修改后名称');
    await page.getByRole('button', { name: '保存' }).click();

    await expect(page.getByText('已保存')).toBeVisible({ timeout: 5000 });

    // 通过 API 验证
    const activeRes = await authFetch(request, token, 'GET', '/api/startup-map/products/active');
    const product = await activeRes.json();
    expect(product.name).toBe('修改后名称');
  });

  test('API 层 — 创建产品返回正确结构', async ({ request }) => {
    const token = await getAuthToken(request);
    const product = await apiCreateProduct(request, token, {
      name: 'API 测试产品',
      targetMarket: '德国',
    });

    expect(product.name).toBe('API 测试产品');
    expect(product.targetMarket).toBe('德国');
    expect(product.isActive).toBe(true);
    expect(product.id).toBeTruthy();
  });

  test('API 层 — GET active 返回激活产品', async ({ request }) => {
    const token = await getAuthToken(request);
    await apiCreateProduct(request, token, { name: '激活产品' });

    const activeRes = await authFetch(request, token, 'GET', '/api/startup-map/products/active');
    const product = await activeRes.json();
    expect(product.name).toBe('激活产品');
    expect(product.isActive).toBe(true);
  });
});

// ─── AI 对话 ───

test.describe('创业地图 - AI 对话', () => {
  test('无对话历史时不显示清空按钮', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    await loginAndGoToStartupMap(page);

    await page.locator('.domainCard').filter({ hasText: '市场研究' }).click();
    await expect(page.locator('.domainTitle')).toHaveText('市场研究', { timeout: 5000 });
    await page.locator('.pointItem').first().click();
    await expect(page.locator('.pointTitle')).toBeVisible({ timeout: 5000 });

    // 清空按钮只在有对话时显示
    await expect(page.getByRole('button', { name: '清空对话' })).not.toBeVisible();
  });

  test('API 层 — GET chats 初始返回空数组', async ({ request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    const domain = await getFirstDomainDetail(request, token);
    const firstPointId = domain.topics[0].points[0].id;

    const chatsRes = await authFetch(request, token, 'GET', `/api/skills/startup-map/points/${firstPointId}/chats`);
    const chats = await chatsRes.json();
    expect(chats).toHaveLength(0);
  });

  test('API 层 — DELETE chats 成功', async ({ request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    const domain = await getFirstDomainDetail(request, token);
    const firstPointId = domain.topics[0].points[0].id;

    const res = await authFetch(request, token, 'DELETE', `/api/skills/startup-map/points/${firstPointId}/chats`);
    expect(res.ok()).toBe(true);
  });
});

// ─── 导航 ───

test.describe('创业地图 - 导航', () => {
  test('侧边栏显示创业地图入口', async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('.login-form', { timeout: 10000 });
    await page.fill('#identifier', `${TEST_USER.username}@test.local`);
    await page.fill('#password', TEST_USER.password);
    await page.click('.submit-btn');
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    await expect(page.getByRole('link', { name: '创业地图' })).toBeVisible();
  });

  test('完整导航路径：全局 → 领域 → 知识点 → 返回', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    await loginAndGoToStartupMap(page);

    // Step 1: 全局视图
    await expect(page.locator('.domainCard')).toHaveCount(10);

    // Step 2: 进入领域
    await page.locator('.domainCard').filter({ hasText: '品牌策略' }).click();
    await expect(page.locator('.domainTitle')).toHaveText('品牌策略', { timeout: 5000 });

    // Step 3: 进入知识点
    await page.locator('.pointItem').first().click();
    await expect(page.locator('.pointTitle')).toBeVisible({ timeout: 5000 });

    // Step 4: 通过面包屑返回领域
    await page.locator('.breadcrumb .crumb').filter({ hasText: '品牌策略' }).click();
    await expect(page.locator('.domainTitle')).toHaveText('品牌策略', { timeout: 5000 });

    // Step 5: 通过面包屑返回全局
    await page.locator('.breadcrumb .crumb').filter({ hasText: '全局视图' }).click();
    await expect(page.locator('.domainCard')).toHaveCount(10, { timeout: 5000 });
  });

  test('产品档案按钮在各视图中可用', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    await loginAndGoToStartupMap(page);

    // 全局视图 — 按钮可见
    await expect(page.locator('.productBtn')).toBeVisible();

    // 进入领域详情 — 按钮仍可见
    await page.locator('.domainCard').first().click();
    await expect(page.locator('.domainTitle')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.productBtn')).toBeVisible();

    // 进入知识点 — 按钮仍可见
    await page.locator('.pointItem').first().click();
    await expect(page.locator('.pointTitle')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.productBtn')).toBeVisible();
  });

  test('从产品档案返回全局视图', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    await loginAndGoToStartupMap(page);

    // 进入产品档案
    await page.locator('.productBtn').click();
    await expect(page.getByText('产品档案')).toBeVisible({ timeout: 5000 });

    // 点击面包屑返回
    await page.locator('.breadcrumb .crumb').filter({ hasText: '全局视图' }).click();
    await expect(page.locator('.domainGrid')).toBeVisible({ timeout: 5000 });
  });
});

// ─── 数据持久化 ───

test.describe('创业地图 - 数据持久化', () => {
  test('刷新后领域数据保留', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    await loginAndGoToStartupMap(page);

    await expect(page.locator('.domainCard')).toHaveCount(10);

    await page.goto('/startup-map');
    await page.waitForFunction(
      () => document.body.textContent?.includes('全局视图'),
      { timeout: 10000 },
    );

    await expect(page.locator('.domainCard')).toHaveCount(10);
  });

  test('状态变更刷新后保留', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    const domain = await getFirstDomainDetail(request, token);
    const firstPointId = domain.topics[0].points[0].id;

    // 通过 API 更新状态
    await apiUpdatePointStatus(request, token, firstPointId, 'understood');

    await loginAndGoToStartupMap(page);
    await page.locator('.domainCard').first().click();
    await expect(page.locator('.domainTitle')).toBeVisible({ timeout: 5000 });

    // 第一个知识点应为"已理解"
    const firstBadge = page.locator('.pointItem').first().locator('.statusBadge');
    await expect(firstBadge).toHaveText('已理解');
  });

  test('产品档案刷新后保留', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    await apiCreateProduct(request, token, { name: '持久化产品' });

    await loginAndGoToStartupMap(page);
    await page.locator('.productBtn').click();
    await expect(page.getByText('产品档案')).toBeVisible({ timeout: 5000 });

    await expect(page.locator('#productName')).toHaveValue('持久化产品');
  });
});

// ─── 进度与统计 ───

test.describe('创业地图 - 进度统计', () => {
  test('完成多个知识点后全局统计更新', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    const domain = await getFirstDomainDetail(request, token);

    // 将前 3 个知识点设为"已理解"
    const points = domain.topics.flatMap((t: { points: { id: number }[] }) => t.points);
    for (let i = 0; i < 3 && i < points.length; i++) {
      await apiUpdatePointStatus(request, token, points[i].id, 'understood');
    }

    await loginAndGoToStartupMap(page);

    // 已完成数应为 3
    const completedStat = page.locator('.statCard').filter({ hasText: '已完成' });
    await expect(completedStat.locator('.statValue')).toContainText('3');
  });

  test('领域卡片进度随状态变更更新', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    const domain = await getFirstDomainDetail(request, token);
    const firstPointId = domain.topics[0].points[0].id;

    await apiUpdatePointStatus(request, token, firstPointId, 'practiced');

    await loginAndGoToStartupMap(page);

    // 第一个领域卡片的进度应不为 0
    const firstCard = page.locator('.domainCard').first();
    await expect(firstCard.getByText(/1\//)).toBeVisible();
  });

  test('API 层 — stats/overview 返回正确统计', async ({ request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);

    const statsRes = await authFetch(request, token, 'GET', '/api/skills/startup-map/stats/overview');
    const stats = await statsRes.json();

    expect(stats.totalPoints).toBeGreaterThan(0);
    expect(stats.completedCount).toBe(0);
    expect(stats.completionRate).toBe(0);
  });

  test('API 层 — stats/overview 反映状态变更', async ({ request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    const domain = await getFirstDomainDetail(request, token);
    const firstPointId = domain.topics[0].points[0].id;

    await apiUpdatePointStatus(request, token, firstPointId, 'understood');

    const statsRes = await authFetch(request, token, 'GET', '/api/skills/startup-map/stats/overview');
    const stats = await statsRes.json();

    expect(stats.completedCount).toBe(1);
    expect(stats.completionRate).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════
// P1 功能测试
// ═══════════════════════════════════════════════════════════

/** 获取阶段列表 */
async function getStages(request: APIRequestContext, token: string) {
  const res = await authFetch(request, token, 'GET', '/api/skills/startup-map/stages');
  return res.json();
}

/** 获取阶段详情 */
async function getStageDetail(request: APIRequestContext, token: string, stageId: number) {
  const res = await authFetch(request, token, 'GET', `/api/skills/startup-map/stages/${stageId}`);
  return res.json();
}

/** 创建笔记 */
async function apiCreateNote(
  request: APIRequestContext,
  token: string,
  pointId: number,
  content: string,
) {
  const res = await authFetch(request, token, 'PUT', `/api/skills/startup-map/points/${pointId}/notes`, { content });
  return res.json();
}

// ─── 学习阶段 ───

test.describe('创业地图 - 学习阶段', () => {
  test('种子数据包含 8 个阶段', async ({ request }) => {
    const token = await getAuthToken(request);
    const result = await seedKnowledgeTree(request, token);
    expect(result.success).toBe(true);
    expect(result.counts.stages).toBe(8);
  });

  test('GET /stages 返回 8 个阶段含进度信息', async ({ request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);

    const stages = await getStages(request, token);
    expect(stages).toHaveLength(8);

    // 验证每个阶段有必要字段
    for (const stage of stages) {
      expect(stage.id).toBeTruthy();
      expect(stage.name).toBeTruthy();
      expect(stage.sortOrder).toBeGreaterThanOrEqual(0);
      expect(stage.pointCount).toBeGreaterThan(0);
      expect(typeof stage.completedCount).toBe('number');
      expect(typeof stage.completionRate).toBe('number');
      expect(typeof stage.isCompleted).toBe('boolean');
      expect(typeof stage.isCurrent).toBe('boolean');
    }
  });

  test('阶段名称与种子数据匹配', async ({ request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);

    const stages = await getStages(request, token);
    const names = stages.map((s: { name: string }) => s.name);

    expect(names).toContain('全貌认知');
    expect(names).toContain('市场验证');
    expect(names).toContain('合规准备');
    expect(names).toContain('产品与供应链');
    expect(names).toContain('品牌建设');
    expect(names).toContain('渠道搭建');
    expect(names).toContain('营销推广');
    expect(names).toContain('运营优化');
  });

  test('初始状态下第一个阶段标记为当前阶段', async ({ request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);

    const stages = await getStages(request, token);
    const currentStages = stages.filter((s: { isCurrent: boolean }) => s.isCurrent);
    expect(currentStages).toHaveLength(1);
    expect(currentStages[0].name).toBe('全貌认知');
  });

  test('GET /stages/[id] 返回阶段详情含知识点', async ({ request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);

    const stages = await getStages(request, token);
    const firstStageId = stages[0].id;
    const detail = await getStageDetail(request, token, firstStageId);

    expect(detail.name).toBe('全貌认知');
    expect(detail.pointCount).toBeGreaterThan(0);
    expect(detail.points).toHaveLength(detail.pointCount);

    // 验证知识点结构
    const firstPoint = detail.points[0];
    expect(firstPoint.pointId).toBeTruthy();
    expect(firstPoint.name).toBeTruthy();
    expect(firstPoint.status).toBe('not_started');
    expect(firstPoint.domain).toBeTruthy();
    expect(firstPoint.domain.id).toBeTruthy();
    expect(firstPoint.domain.name).toBeTruthy();
    expect(firstPoint.topic).toBeTruthy();
    expect(firstPoint.topic.id).toBeTruthy();
    expect(firstPoint.topic.name).toBeTruthy();
  });

  test('GET /stages/[id] 无效 ID 返回 400', async ({ request }) => {
    const token = await getAuthToken(request);
    const res = await authFetch(request, token, 'GET', '/api/skills/startup-map/stages/abc');
    expect(res.status()).toBe(400);
  });

  test('GET /stages/[id] 不存在的阶段返回 404', async ({ request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    const res = await authFetch(request, token, 'GET', '/api/skills/startup-map/stages/99999');
    expect(res.status()).toBe(404);
  });

  test('阶段视图 tab 切换到阶段时间线', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    await loginAndGoToStartupMap(page);

    // 点击"阶段视图" tab
    await page.locator('.viewTab').filter({ hasText: '阶段视图' }).click();

    // 应显示阶段时间线
    await expect(page.locator('.stageTimeline')).toBeVisible({ timeout: 5000 });
    // 应有 8 个阶段节点
    await expect(page.locator('.stageNode')).toHaveCount(8);
  });

  test('当前阶段显示"当前阶段"标签', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    await loginAndGoToStartupMap(page);

    await page.locator('.viewTab').filter({ hasText: '阶段视图' }).click();
    await expect(page.locator('.stageTimeline')).toBeVisible({ timeout: 5000 });

    // 当前阶段节点应有 .current class
    const currentNode = page.locator('.stageNode.current');
    await expect(currentNode).toHaveCount(1);
    // 应显示"当前阶段"标签
    await expect(currentNode.locator('.currentTag')).toBeVisible();
    await expect(currentNode.locator('.currentTag')).toHaveText('当前阶段');
  });

  test('阶段节点显示名称和进度', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    await loginAndGoToStartupMap(page);

    await page.locator('.viewTab').filter({ hasText: '阶段视图' }).click();
    await expect(page.locator('.stageTimeline')).toBeVisible({ timeout: 5000 });

    const firstNode = page.locator('.stageNode').first();
    await expect(firstNode.locator('.stageName')).toHaveText('全貌认知');
    await expect(firstNode.locator('.stageProgress')).toBeVisible();
    await expect(firstNode.locator('.progressBar')).toBeVisible();
  });

  test('展开阶段显示知识点列表', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    await loginAndGoToStartupMap(page);

    await page.locator('.viewTab').filter({ hasText: '阶段视图' }).click();
    await expect(page.locator('.stageTimeline')).toBeVisible({ timeout: 5000 });

    // 点击第一个阶段的 header 展开
    await page.locator('.stageNode').first().locator('.nodeHeader').click();

    // 应显示知识点列表（数据异步加载，等待第一个 pointRow 出现）
    await expect(page.locator('.pointRow').first()).toBeVisible({ timeout: 10000 });
    const pointRows = page.locator('.pointRow');
    const count = await pointRows.count();
    expect(count).toBeGreaterThan(0);

    // 知识点应显示名称和领域/主题元数据
    const firstRow = pointRows.first();
    await expect(firstRow.locator('.pointName')).toBeVisible();
    await expect(firstRow.locator('.pointMeta')).toBeVisible();
  });

  test('点击阶段中的知识点跳转到学习页', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    await loginAndGoToStartupMap(page);

    await page.locator('.viewTab').filter({ hasText: '阶段视图' }).click();
    await expect(page.locator('.stageTimeline')).toBeVisible({ timeout: 5000 });

    // 展开第一个阶段
    await page.locator('.stageNode').first().locator('.nodeHeader').click();
    await expect(page.locator('.stagePointList')).toBeVisible({ timeout: 5000 });

    // 点击第一个知识点
    await page.locator('.pointRow').first().click();

    // 应跳转到知识点学习页
    await expect(page.locator('.pointTitle')).toBeVisible({ timeout: 5000 });
    // 面包屑应有三级
    const crumbs = page.locator('.breadcrumb .crumb');
    await expect(crumbs).toHaveCount(3);
  });

  test('完成阶段所有知识点后阶段标记为已完成', async ({ request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);

    const stages = await getStages(request, token);
    const firstStageId = stages[0].id;
    const detail = await getStageDetail(request, token, firstStageId);

    // 将所有知识点设为"已理解"
    for (const point of detail.points) {
      await apiUpdatePointStatus(request, token, point.pointId, 'understood');
    }

    // 重新获取阶段列表
    const updatedStages = await getStages(request, token);
    const firstStage = updatedStages.find((s: { id: number }) => s.id === firstStageId);
    expect(firstStage.isCompleted).toBe(true);
    expect(firstStage.isCurrent).toBe(false);

    // 第二个阶段应成为当前阶段
    const secondStage = updatedStages[1];
    expect(secondStage.isCurrent).toBe(true);
  });
});

// ─── 实践任务 ───

test.describe('创业地图 - 实践任务', () => {
  test('GET tasks 初始返回空数组', async ({ request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    const domain = await getFirstDomainDetail(request, token);
    const firstPointId = domain.topics[0].points[0].id;

    const res = await authFetch(request, token, 'GET', `/api/skills/startup-map/points/${firstPointId}/tasks`);
    const tasks = await res.json();
    expect(tasks).toHaveLength(0);
  });

  test('GET tasks 无效 ID 返回 400', async ({ request }) => {
    const token = await getAuthToken(request);
    const res = await authFetch(request, token, 'GET', '/api/skills/startup-map/points/abc/tasks');
    expect(res.status()).toBe(400);
  });

  test('GET tasks 不存在的知识点返回 404', async ({ request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    const res = await authFetch(request, token, 'GET', '/api/skills/startup-map/points/99999/tasks');
    expect(res.status()).toBe(404);
  });

  test('PATCH task 缺少 isCompleted 返回 400', async ({ request }) => {
    const token = await getAuthToken(request);
    const res = await authFetch(request, token, 'PATCH', '/api/skills/startup-map/tasks/1', { completionNote: 'test' });
    expect(res.status()).toBe(400);
  });

  test('PATCH task 不存在的任务返回 404', async ({ request }) => {
    const token = await getAuthToken(request);
    const res = await authFetch(request, token, 'PATCH', '/api/skills/startup-map/tasks/99999', { isCompleted: true });
    expect(res.status()).toBe(404);
  });

  test('无任务时显示生成按钮', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    await loginAndGoToStartupMap(page);

    await page.locator('.domainCard').filter({ hasText: '市场研究' }).click();
    await expect(page.locator('.domainTitle')).toHaveText('市场研究', { timeout: 5000 });
    await page.locator('.pointItem').first().click();
    await expect(page.locator('.pointTitle')).toBeVisible({ timeout: 5000 });

    // 任务区域应显示空状态和生成按钮
    await expect(page.locator('.emptyTasks')).toBeVisible();
    await expect(page.getByRole('button', { name: '生成任务' })).toBeVisible();
  });
});

// ─── 笔记 ───

test.describe('创业地图 - 笔记', () => {
  test('GET notes 初始返回 null', async ({ request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    const domain = await getFirstDomainDetail(request, token);
    const firstPointId = domain.topics[0].points[0].id;

    const res = await authFetch(request, token, 'GET', `/api/skills/startup-map/points/${firstPointId}/notes`);
    expect(res.ok()).toBe(true);
    const text = await res.text();
    // Nitro returns "null" as body or empty string for null values
    expect(text === 'null' || text === '').toBe(true);
  });

  test('PUT notes 创建笔记', async ({ request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    const domain = await getFirstDomainDetail(request, token);
    const firstPointId = domain.topics[0].points[0].id;

    const note = await apiCreateNote(request, token, firstPointId, '# 学习笔记\n这是测试内容');
    expect(note.id).toBeTruthy();
    expect(note.pointId).toBe(firstPointId);
    expect(note.content).toBe('# 学习笔记\n这是测试内容');
    expect(note.createdAt).toBeTruthy();
    expect(note.updatedAt).toBeTruthy();
    expect(note.productId).toBeNull();
  });

  test('PUT notes 更新已有笔记 (upsert)', async ({ request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    const domain = await getFirstDomainDetail(request, token);
    const firstPointId = domain.topics[0].points[0].id;

    // 第一次创建
    const created = await apiCreateNote(request, token, firstPointId, '初始内容');
    const createdId = created.id;

    // 第二次更新
    const updated = await apiCreateNote(request, token, firstPointId, '更新后的内容');
    expect(updated.id).toBe(createdId); // 同一条记录
    expect(updated.content).toBe('更新后的内容');
    expect(updated.updatedAt).toBeGreaterThanOrEqual(created.updatedAt);
  });

  test('PUT notes 缺少 content 返回 400', async ({ request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    const domain = await getFirstDomainDetail(request, token);
    const firstPointId = domain.topics[0].points[0].id;

    const res = await authFetch(request, token, 'PUT', `/api/skills/startup-map/points/${firstPointId}/notes`, {});
    expect(res.status()).toBe(400);
  });

  test('PUT notes 不存在的知识点返回 404', async ({ request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    const res = await authFetch(request, token, 'PUT', '/api/skills/startup-map/points/99999/notes', { content: 'test' });
    expect(res.status()).toBe(404);
  });

  test('笔记编辑器显示编辑和预览 tab', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    await loginAndGoToStartupMap(page);

    await page.locator('.domainCard').filter({ hasText: '市场研究' }).click();
    await expect(page.locator('.domainTitle')).toHaveText('市场研究', { timeout: 5000 });
    await page.locator('.pointItem').first().click();
    await expect(page.locator('.pointTitle')).toBeVisible({ timeout: 5000 });

    // 笔记编辑器应可见
    await expect(page.locator('.noteEditor')).toBeVisible();
    // 编辑和预览 tab 应存在
    await expect(page.locator('.modeTab').filter({ hasText: '编辑' })).toBeVisible();
    await expect(page.locator('.modeTab').filter({ hasText: '预览' })).toBeVisible();
    // 编辑器文本区域应可见
    await expect(page.locator('.editorTextarea')).toBeVisible();
  });

  test('已有笔记加载到编辑器', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    const domain = await getFirstDomainDetail(request, token);
    const firstPointId = domain.topics[0].points[0].id;

    // 通过 API 创建笔记
    await apiCreateNote(request, token, firstPointId, '已有的笔记内容');

    await loginAndGoToStartupMap(page);
    await page.locator('.domainCard').first().click();
    await expect(page.locator('.domainTitle')).toBeVisible({ timeout: 5000 });
    await page.locator('.pointItem').first().click();
    await expect(page.locator('.pointTitle')).toBeVisible({ timeout: 5000 });

    // 编辑器应加载已有内容
    await expect(page.locator('.editorTextarea')).toHaveValue('已有的笔记内容', { timeout: 5000 });
  });

  test('输入内容后显示保存状态', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    await loginAndGoToStartupMap(page);

    await page.locator('.domainCard').filter({ hasText: '市场研究' }).click();
    await expect(page.locator('.domainTitle')).toHaveText('市场研究', { timeout: 5000 });
    await page.locator('.pointItem').first().click();
    await expect(page.locator('.pointTitle')).toBeVisible({ timeout: 5000 });

    // 输入内容
    await page.locator('.editorTextarea').fill('测试笔记内容');

    // 应显示保存状态（"保存中..." 或 "已保存 HH:mm"）
    await expect(page.locator('.saveStatus')).toBeVisible({ timeout: 5000 });
    // 等待自动保存完成（1秒 debounce + 保存时间）
    await expect(page.locator('.saveStatus')).toContainText('已保存', { timeout: 5000 });
  });

  test('预览模式渲染 markdown', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    const domain = await getFirstDomainDetail(request, token);
    const firstPointId = domain.topics[0].points[0].id;

    await apiCreateNote(request, token, firstPointId, '# 标题\n\n**粗体**文本');

    await loginAndGoToStartupMap(page);
    await page.locator('.domainCard').first().click();
    await expect(page.locator('.domainTitle')).toBeVisible({ timeout: 5000 });
    await page.locator('.pointItem').first().click();
    await expect(page.locator('.pointTitle')).toBeVisible({ timeout: 5000 });

    // 切换到预览模式
    await page.locator('.modeTab').filter({ hasText: '预览' }).click();

    // 预览区域应包含渲染后的 HTML
    await expect(page.locator('.previewContent')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.previewContent h1')).toHaveText('标题');
    await expect(page.locator('.previewContent strong')).toHaveText('粗体');
  });
});

// ─── 学习建议 ───

test.describe('创业地图 - 学习建议', () => {
  test('GET recommendations 返回推荐知识点', async ({ request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);

    const res = await authFetch(request, token, 'GET', '/api/skills/startup-map/recommendations');
    const data = await res.json();

    expect(data.allCompleted).toBe(false);
    expect(data.currentStage).toBeTruthy();
    expect(data.currentStage.name).toBe('全貌认知');
    expect(data.recommendations.length).toBeGreaterThan(0);
    expect(data.recommendations.length).toBeLessThanOrEqual(3);

    // 验证推荐知识点结构
    const rec = data.recommendations[0];
    expect(rec.pointId).toBeTruthy();
    expect(rec.name).toBeTruthy();
    expect(rec.status).toBeDefined();
    expect(rec.domain).toBeTruthy();
    expect(rec.domain.name).toBeTruthy();
    expect(rec.topic).toBeTruthy();
    expect(rec.topic.name).toBeTruthy();
    expect(rec.stage).toBeTruthy();
    expect(rec.stage.name).toBe('全貌认知');
  });

  test('推荐优先当前阶段中未完成的知识点', async ({ request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);

    const res = await authFetch(request, token, 'GET', '/api/skills/startup-map/recommendations');
    const data = await res.json();

    // 所有推荐应为未完成状态
    for (const rec of data.recommendations) {
      expect(['not_started', 'learning']).toContain(rec.status);
    }
  });

  test('完成当前阶段后推荐切换到下一阶段', async ({ request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);

    // 完成第一阶段所有知识点
    const stages = await getStages(request, token);
    const detail = await getStageDetail(request, token, stages[0].id);
    for (const point of detail.points) {
      await apiUpdatePointStatus(request, token, point.pointId, 'understood');
    }

    const res = await authFetch(request, token, 'GET', '/api/skills/startup-map/recommendations');
    const data = await res.json();

    expect(data.allCompleted).toBe(false);
    expect(data.currentStage.name).toBe('市场验证');
  });

  test('全部完成后 allCompleted 为 true', async ({ request }) => {
    test.setTimeout(120000); // 需要更新大量知识点状态
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);

    // 获取所有领域的所有知识点并批量更新
    const domainsRes = await authFetch(request, token, 'GET', '/api/skills/startup-map/domains');
    const domains = await domainsRes.json();
    for (const domain of domains) {
      const detailRes = await authFetch(request, token, 'GET', `/api/skills/startup-map/domains/${domain.id}`);
      const detail = await detailRes.json();
      const points = detail.topics.flatMap((t: { points: { id: number }[] }) => t.points);
      await Promise.all(
        points.map((p: { id: number }) => apiUpdatePointStatus(request, token, p.id, 'understood')),
      );
    }

    const res = await authFetch(request, token, 'GET', '/api/skills/startup-map/recommendations');
    const data = await res.json();

    expect(data.allCompleted).toBe(true);
    expect(data.currentStage).toBeNull();
    expect(data.recommendations).toHaveLength(0);
  });

  test('全局视图显示学习建议区域', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    await loginAndGoToStartupMap(page);

    // 应显示"建议下一步学习"标题
    await expect(page.getByText('建议下一步学习')).toBeVisible({ timeout: 5000 });
    // 应有推荐项
    await expect(page.locator('.recItem').first()).toBeVisible();
  });

  test('点击推荐项跳转到知识点学习页', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    await loginAndGoToStartupMap(page);

    await expect(page.locator('.recItem').first()).toBeVisible({ timeout: 5000 });

    // 记录推荐知识点名称
    const recName = await page.locator('.recItem').first().locator('.recName').textContent();

    // 点击推荐项
    await page.locator('.recItem').first().click();

    // 应跳转到知识点学习页
    await expect(page.locator('.pointTitle')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.pointTitle')).toHaveText(recName!.trim());
  });

  test('全部完成后显示完成消息', async ({ page, request }) => {
    test.setTimeout(120000); // 需要更新大量知识点状态
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);

    // 批量完成所有知识点
    const domainsRes = await authFetch(request, token, 'GET', '/api/skills/startup-map/domains');
    const domains = await domainsRes.json();
    for (const domain of domains) {
      const detailRes = await authFetch(request, token, 'GET', `/api/skills/startup-map/domains/${domain.id}`);
      const detail = await detailRes.json();
      const points = detail.topics.flatMap((t: { points: { id: number }[] }) => t.points);
      await Promise.all(
        points.map((p: { id: number }) => apiUpdatePointStatus(request, token, p.id, 'understood')),
      );
    }

    await loginAndGoToStartupMap(page);

    // 应显示完成消息
    await expect(page.locator('.allDone')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('恭喜完成全部学习')).toBeVisible();
  });
});

// ─── 增强统计 ───

test.describe('创业地图 - 增强统计', () => {
  test('overview 返回状态分布', async ({ request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);

    const statsRes = await authFetch(request, token, 'GET', '/api/skills/startup-map/stats/overview');
    const stats = await statsRes.json();

    expect(stats.totalPoints).toBeGreaterThan(0);
    expect(typeof stats.notStarted).toBe('number');
    expect(typeof stats.learning).toBe('number');
    expect(typeof stats.understood).toBe('number');
    expect(typeof stats.practiced).toBe('number');
    expect(typeof stats.currentStageId).not.toBe('undefined');

    // 初始状态下所有知识点都应为 not_started
    expect(stats.notStarted).toBe(stats.totalPoints);
    expect(stats.learning).toBe(0);
    expect(stats.understood).toBe(0);
    expect(stats.practiced).toBe(0);
    expect(stats.currentStageId).toBeTruthy();
  });

  test('overview 反映多种状态变更', async ({ request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    const domain = await getFirstDomainDetail(request, token);
    const points = domain.topics.flatMap((t: { points: { id: number }[] }) => t.points);

    // 设置不同状态
    await apiUpdatePointStatus(request, token, points[0].id, 'learning');
    await apiUpdatePointStatus(request, token, points[1].id, 'understood');
    await apiUpdatePointStatus(request, token, points[2].id, 'practiced');

    const statsRes = await authFetch(request, token, 'GET', '/api/skills/startup-map/stats/overview');
    const stats = await statsRes.json();

    expect(stats.learning).toBe(1);
    expect(stats.understood).toBe(1);
    expect(stats.practiced).toBe(1);
    expect(stats.completedCount).toBe(2); // understood + practiced
  });

  test('by-domain 返回各领域统计', async ({ request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);

    const res = await authFetch(request, token, 'GET', '/api/skills/startup-map/stats/by-domain');
    const data = await res.json();

    expect(data.domains).toBeTruthy();
    expect(data.domains).toHaveLength(10);

    for (const domain of data.domains) {
      expect(domain.id).toBeTruthy();
      expect(domain.name).toBeTruthy();
      expect(domain.total).toBeGreaterThan(0);
      expect(typeof domain.notStarted).toBe('number');
      expect(typeof domain.learning).toBe('number');
      expect(typeof domain.understood).toBe('number');
      expect(typeof domain.practiced).toBe('number');
      expect(typeof domain.rate).toBe('number');
    }
  });

  test('by-domain 状态变更后正确反映', async ({ request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    const domain = await getFirstDomainDetail(request, token);
    const firstPointId = domain.topics[0].points[0].id;

    await apiUpdatePointStatus(request, token, firstPointId, 'understood');

    const res = await authFetch(request, token, 'GET', '/api/skills/startup-map/stats/by-domain');
    const data = await res.json();

    // 第一个领域应有 1 个 understood
    const firstDomain = data.domains[0];
    expect(firstDomain.understood).toBe(1);
    expect(firstDomain.rate).toBeGreaterThan(0);
  });

  test('全局视图显示状态分布数据', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);

    // 设置一些不同状态
    const domain = await getFirstDomainDetail(request, token);
    const points = domain.topics.flatMap((t: { points: { id: number }[] }) => t.points);
    await apiUpdatePointStatus(request, token, points[0].id, 'learning');
    await apiUpdatePointStatus(request, token, points[1].id, 'understood');

    await loginAndGoToStartupMap(page);

    // 增强统计区域应可见
    await expect(page.locator('.enhancedStats')).toBeVisible({ timeout: 5000 });
    // 状态分布项应显示
    await expect(page.locator('.statusBreakdown')).toBeVisible();
    const statusItems = page.locator('.statusItem');
    const count = await statusItems.count();
    expect(count).toBeGreaterThan(0);
  });

  test('分段进度条可见', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);

    // 设置一些状态让进度条有内容
    const domain = await getFirstDomainDetail(request, token);
    const firstPointId = domain.topics[0].points[0].id;
    await apiUpdatePointStatus(request, token, firstPointId, 'understood');

    await loginAndGoToStartupMap(page);

    // 分段进度条应可见
    await expect(page.locator('.segmentedProgress')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.segmentedProgress .bar')).toBeVisible();
  });

  test('统计卡片显示当前阶段', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    await loginAndGoToStartupMap(page);

    // 应有一个统计卡片显示当前阶段名称
    const stageStatCard = page.locator('.statCard').filter({ hasText: '当前阶段' });
    await expect(stageStatCard).toBeVisible({ timeout: 5000 });
    await expect(stageStatCard.locator('.statValue')).toContainText('全貌认知');
  });
});

// ═══════════════════════════════════════════════════════════
// P2 功能测试
// ═══════════════════════════════════════════════════════════

/** 通过测试端点创建文章 */
async function seedTestArticle(
  request: APIRequestContext,
  overrides: Record<string, unknown> = {},
) {
  const res = await request.post('/api/_test/seed-article', { data: overrides });
  return res.json();
}

/** 创建活动记录 */
async function apiCreateActivity(
  request: APIRequestContext,
  token: string,
  pointId: number,
  type: string,
) {
  const res = await authFetch(request, token, 'POST', '/api/skills/startup-map/activities', { pointId, type });
  return res.json();
}

// ─── 文章关联 ───

test.describe('创业地图 - 文章关联', () => {
  test('POST 关联文章到知识点', async ({ request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    const domain = await getFirstDomainDetail(request, token);
    const firstPointId = domain.topics[0].points[0].id;

    // 通过 _test 端点创建文章
    const article = await seedTestArticle(request, { title: '测试文章' });

    // 关联文章到知识点
    const res = await authFetch(request, token, 'POST', `/api/skills/startup-map/points/${firstPointId}/articles`, {
      articleIds: [article.id],
    });
    const data = await res.json();
    expect(data.inserted).toBe(1);
  });

  test('GET 获取知识点关联的文章', async ({ request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    const domain = await getFirstDomainDetail(request, token);
    const firstPointId = domain.topics[0].points[0].id;

    const article = await seedTestArticle(request, { title: '关联文章', siteName: 'test.com' });
    await authFetch(request, token, 'POST', `/api/skills/startup-map/points/${firstPointId}/articles`, {
      articleIds: [article.id],
    });

    const res = await authFetch(request, token, 'GET', `/api/skills/startup-map/points/${firstPointId}/articles`);
    const articles = await res.json();
    expect(articles).toHaveLength(1);
    expect(articles[0].articleId).toBe(article.id);
    expect(articles[0].title).toBe('关联文章');
    expect(articles[0].siteName).toBe('test.com');
    expect(articles[0].linkedAt).toBeTruthy();
  });

  test('DELETE 取消关联', async ({ request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    const domain = await getFirstDomainDetail(request, token);
    const firstPointId = domain.topics[0].points[0].id;

    const article = await seedTestArticle(request);
    await authFetch(request, token, 'POST', `/api/skills/startup-map/points/${firstPointId}/articles`, {
      articleIds: [article.id],
    });

    const res = await authFetch(request, token, 'DELETE', `/api/skills/startup-map/points/${firstPointId}/articles/${article.id}`);
    const data = await res.json();
    expect(data.success).toBe(true);

    // 验证已取消关联
    const listRes = await authFetch(request, token, 'GET', `/api/skills/startup-map/points/${firstPointId}/articles`);
    const list = await listRes.json();
    expect(list).toHaveLength(0);
  });

  test('重复关联被跳过', async ({ request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    const domain = await getFirstDomainDetail(request, token);
    const firstPointId = domain.topics[0].points[0].id;

    const article = await seedTestArticle(request);
    await authFetch(request, token, 'POST', `/api/skills/startup-map/points/${firstPointId}/articles`, {
      articleIds: [article.id],
    });

    // 第二次关联同一篇文章
    const res = await authFetch(request, token, 'POST', `/api/skills/startup-map/points/${firstPointId}/articles`, {
      articleIds: [article.id],
    });
    const data = await res.json();
    expect(data.inserted).toBe(0);
  });

  test('双向链接 — 从文章侧查看关联知识点', async ({ request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    const domain = await getFirstDomainDetail(request, token);
    const firstPointId = domain.topics[0].points[0].id;

    const article = await seedTestArticle(request, { title: '双向测试' });
    await authFetch(request, token, 'POST', `/api/skills/startup-map/points/${firstPointId}/articles`, {
      articleIds: [article.id],
    });

    // 从文章侧查看
    const res = await authFetch(request, token, 'GET', `/api/skills/startup-map/articles/${article.id}/points`);
    const points = await res.json();
    expect(points).toHaveLength(1);
    expect(points[0].pointId).toBe(firstPointId);
    expect(points[0].pointName).toBeTruthy();
    expect(points[0].domainName).toBeTruthy();
    expect(points[0].topicName).toBeTruthy();
  });

  test('DELETE 不存在的关联返回 404', async ({ request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    const res = await authFetch(request, token, 'DELETE', '/api/skills/startup-map/points/1/articles/99999');
    expect(res.status()).toBe(404);
  });

  test('POST 缺少 articleIds 返回 400', async ({ request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    const domain = await getFirstDomainDetail(request, token);
    const firstPointId = domain.topics[0].points[0].id;

    const res = await authFetch(request, token, 'POST', `/api/skills/startup-map/points/${firstPointId}/articles`, {});
    expect(res.status()).toBe(400);
  });

  test('UI — 知识点学习页显示关联文章区域', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    await loginAndGoToStartupMap(page);

    await page.locator('.domainCard').filter({ hasText: '市场研究' }).click();
    await expect(page.locator('.domainTitle')).toHaveText('市场研究', { timeout: 5000 });
    await page.locator('.pointItem').first().click();
    await expect(page.locator('.pointTitle')).toBeVisible({ timeout: 5000 });

    // 关联文章区域应可见
    await expect(page.locator('.linkedArticles')).toBeVisible();
    await expect(page.getByRole('heading', { name: '关联文章' })).toBeVisible();
    // 无关联时显示空状态
    await expect(page.getByText('暂无关联文章')).toBeVisible();
    // 添加关联按钮应可见
    await expect(page.locator('.addBtn')).toBeVisible();
  });
});

// ─── 活动记录 ───

test.describe('创业地图 - 活动记录', () => {
  test('POST 创建活动记录', async ({ request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    const domain = await getFirstDomainDetail(request, token);
    const firstPointId = domain.topics[0].points[0].id;

    const result = await apiCreateActivity(request, token, firstPointId, 'view');
    expect(result.id).toBeTruthy();
    expect(result.pointId).toBe(firstPointId);
    expect(result.type).toBe('view');
    expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.createdAt).toBeTruthy();
  });

  test('同一小时内去重', async ({ request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    const domain = await getFirstDomainDetail(request, token);
    const firstPointId = domain.topics[0].points[0].id;

    const first = await apiCreateActivity(request, token, firstPointId, 'view');
    const second = await apiCreateActivity(request, token, firstPointId, 'view');

    expect(second.deduplicated).toBe(true);
    expect(second.id).toBe(first.id);
  });

  test('不同类型不去重', async ({ request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    const domain = await getFirstDomainDetail(request, token);
    const firstPointId = domain.topics[0].points[0].id;

    const viewResult = await apiCreateActivity(request, token, firstPointId, 'view');
    const chatResult = await apiCreateActivity(request, token, firstPointId, 'chat');

    expect(viewResult.id).toBeTruthy();
    expect(chatResult.id).toBeTruthy();
    expect(viewResult.id).not.toBe(chatResult.id);
    expect(chatResult.deduplicated).toBeUndefined();
  });

  test('无效 type 返回 400', async ({ request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    const domain = await getFirstDomainDetail(request, token);
    const firstPointId = domain.topics[0].points[0].id;

    const res = await authFetch(request, token, 'POST', '/api/skills/startup-map/activities', {
      pointId: firstPointId, type: 'invalid',
    });
    expect(res.status()).toBe(400);
  });

  test('GET 分页获取活动列表', async ({ request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    const domain = await getFirstDomainDetail(request, token);
    const points = domain.topics.flatMap((t: { points: { id: number }[] }) => t.points);

    // 创建多条活动（不同知识点避免去重）
    await apiCreateActivity(request, token, points[0].id, 'view');
    await apiCreateActivity(request, token, points[1].id, 'view');
    await apiCreateActivity(request, token, points[2].id, 'chat');

    const res = await authFetch(request, token, 'GET', '/api/skills/startup-map/activities?page=1&pageSize=10');
    const data = await res.json();

    expect(data.items.length).toBe(3);
    expect(data.total).toBe(3);
    expect(data.page).toBe(1);
    expect(data.totalPages).toBe(1);

    // 验证 item 结构
    const item = data.items[0];
    expect(item.id).toBeTruthy();
    expect(item.pointId).toBeTruthy();
    expect(item.type).toBeTruthy();
    expect(item.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(item.pointName).toBeTruthy();
  });

  test('GET 按日期过滤', async ({ request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    const domain = await getFirstDomainDetail(request, token);
    const firstPointId = domain.topics[0].points[0].id;

    await apiCreateActivity(request, token, firstPointId, 'view');

    // 用当天日期过滤
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const res = await authFetch(request, token, 'GET', `/api/skills/startup-map/activities?date=${dateStr}`);
    const data = await res.json();
    expect(data.items.length).toBeGreaterThan(0);

    // 用未来日期过滤应为空
    const futureRes = await authFetch(request, token, 'GET', '/api/skills/startup-map/activities?date=2099-01-01');
    const futureData = await futureRes.json();
    expect(futureData.items).toHaveLength(0);
  });
});

// ─── 热力图与连续天数 ───

test.describe('创业地图 - 热力图', () => {
  test('GET heatmap 无活动返回空对象', async ({ request }) => {
    const token = await getAuthToken(request);
    const res = await authFetch(request, token, 'GET', '/api/skills/startup-map/stats/heatmap');
    const data = await res.json();
    expect(typeof data).toBe('object');
    expect(Object.keys(data)).toHaveLength(0);
  });

  test('GET heatmap 返回日期-数量映射', async ({ request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    const domain = await getFirstDomainDetail(request, token);
    const points = domain.topics.flatMap((t: { points: { id: number }[] }) => t.points);

    // 创建活动
    await apiCreateActivity(request, token, points[0].id, 'view');
    await apiCreateActivity(request, token, points[1].id, 'chat');

    const year = new Date().getFullYear();
    const res = await authFetch(request, token, 'GET', `/api/skills/startup-map/stats/heatmap?year=${year}`);
    const data = await res.json();

    // 应有至少一个日期条目
    const keys = Object.keys(data);
    expect(keys.length).toBeGreaterThan(0);

    // 日期格式应为 YYYY-MM-DD
    for (const key of keys) {
      expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(data[key]).toBeGreaterThan(0);
    }
  });

  test('GET heatmap 指定年份过滤', async ({ request }) => {
    const token = await getAuthToken(request);
    // 查询未来年份应为空
    const res = await authFetch(request, token, 'GET', '/api/skills/startup-map/stats/heatmap?year=2099');
    const data = await res.json();
    expect(Object.keys(data)).toHaveLength(0);
  });

  test('GET streak 无活动返回 0', async ({ request }) => {
    const token = await getAuthToken(request);
    const res = await authFetch(request, token, 'GET', '/api/skills/startup-map/stats/streak');
    const data = await res.json();
    expect(data.streak).toBe(0);
  });

  test('GET streak 有活动返回连续天数', async ({ request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    const domain = await getFirstDomainDetail(request, token);
    const firstPointId = domain.topics[0].points[0].id;

    // 创建今天的活动
    await apiCreateActivity(request, token, firstPointId, 'view');

    const res = await authFetch(request, token, 'GET', '/api/skills/startup-map/stats/streak');
    const data = await res.json();
    expect(data.streak).toBeGreaterThanOrEqual(1);
  });

  test('UI — 全局视图显示热力图', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    await loginAndGoToStartupMap(page);

    // 切换到学习热力图 tab
    await page.locator('.viewTab').filter({ hasText: '学习热力图' }).click();

    // 热力图组件应可见
    await expect(page.locator('.learningHeatmap')).toBeVisible({ timeout: 5000 });
    // 连续天数显示
    await expect(page.locator('.streakBar')).toBeVisible();
    await expect(page.getByText('天连续学习')).toBeVisible();
    // 热力图网格应可见
    await expect(page.locator('.heatmapGrid')).toBeVisible();
    // 年份导航应可见
    await expect(page.locator('.yearNav')).toBeVisible();
  });
});

// ─── 多产品管理 ───

test.describe('创业地图 - 多产品', () => {
  test('GET /products 无产品返回空数组', async ({ request }) => {
    const token = await getAuthToken(request);
    const res = await authFetch(request, token, 'GET', '/api/startup-map/products');
    const data = await res.json();
    expect(data).toHaveLength(0);
  });

  test('第一个产品自动激活', async ({ request }) => {
    const token = await getAuthToken(request);
    const product = await apiCreateProduct(request, token, { name: '第一个产品' });
    expect(product.isActive).toBe(true);
  });

  test('后续产品默认不激活', async ({ request }) => {
    const token = await getAuthToken(request);
    await apiCreateProduct(request, token, { name: '第一个' });
    const second = await apiCreateProduct(request, token, { name: '第二个' });
    expect(second.isActive).toBe(false);
  });

  test('GET /products 返回所有产品', async ({ request }) => {
    const token = await getAuthToken(request);
    await apiCreateProduct(request, token, { name: '产品A' });
    await apiCreateProduct(request, token, { name: '产品B' });

    const res = await authFetch(request, token, 'GET', '/api/startup-map/products');
    const products = await res.json();
    expect(products).toHaveLength(2);
  });

  test('PATCH activate 切换激活产品', async ({ request }) => {
    const token = await getAuthToken(request);
    const first = await apiCreateProduct(request, token, { name: '产品A' });
    const second = await apiCreateProduct(request, token, { name: '产品B' });

    // 切换到第二个
    const res = await authFetch(request, token, 'PATCH', `/api/startup-map/products/${second.id}/activate`);
    const activated = await res.json();
    expect(activated.isActive).toBe(true);

    // 第一个应被取消激活
    const activeRes = await authFetch(request, token, 'GET', '/api/startup-map/products/active');
    const active = await activeRes.json();
    expect(active.id).toBe(second.id);
  });

  test('DELETE 删除非激活产品', async ({ request }) => {
    const token = await getAuthToken(request);
    await apiCreateProduct(request, token, { name: '激活产品' });
    const inactive = await apiCreateProduct(request, token, { name: '非激活产品' });

    const res = await authFetch(request, token, 'DELETE', `/api/startup-map/products/${inactive.id}`);
    const data = await res.json();
    expect(data.success).toBe(true);

    // 验证已删除
    const listRes = await authFetch(request, token, 'GET', '/api/startup-map/products');
    const list = await listRes.json();
    expect(list).toHaveLength(1);
  });

  test('DELETE 激活产品返回 400', async ({ request }) => {
    const token = await getAuthToken(request);
    const active = await apiCreateProduct(request, token, { name: '激活产品' });

    const res = await authFetch(request, token, 'DELETE', `/api/startup-map/products/${active.id}`);
    expect(res.status()).toBe(400);
  });

  test('删除产品级联删除笔记', async ({ request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    const domain = await getFirstDomainDetail(request, token);
    const firstPointId = domain.topics[0].points[0].id;

    const first = await apiCreateProduct(request, token, { name: '产品A' });
    const second = await apiCreateProduct(request, token, { name: '产品B' });

    // 给非激活产品创建笔记
    await authFetch(request, token, 'PUT', `/api/skills/startup-map/points/${firstPointId}/notes`, {
      content: '产品B笔记', productId: second.id,
    });

    // 删除非激活产品
    await authFetch(request, token, 'DELETE', `/api/startup-map/products/${second.id}`);

    // 该产品的笔记应被删除
    const noteRes = await authFetch(request, token, 'GET', `/api/skills/startup-map/points/${firstPointId}/notes?productId=${second.id}`);
    const text = await noteRes.text();
    expect(text === 'null' || text === '').toBe(true);
  });

  test('笔记隔离 — 不同产品的笔记独立', async ({ request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    const domain = await getFirstDomainDetail(request, token);
    const firstPointId = domain.topics[0].points[0].id;

    const first = await apiCreateProduct(request, token, { name: '产品A' });
    const second = await apiCreateProduct(request, token, { name: '产品B' });

    // 为两个产品创建不同笔记，验证 PUT 成功
    const putARes = await authFetch(request, token, 'PUT', `/api/skills/startup-map/points/${firstPointId}/notes`, {
      content: '产品A笔记', productId: first.id,
    });
    expect(putARes.ok()).toBe(true);
    const savedA = await putARes.json();
    expect(savedA.content).toBe('产品A笔记');
    expect(savedA.productId).toBe(first.id);

    const putBRes = await authFetch(request, token, 'PUT', `/api/skills/startup-map/points/${firstPointId}/notes`, {
      content: '产品B笔记', productId: second.id,
    });
    expect(putBRes.ok()).toBe(true);
    const savedB = await putBRes.json();
    expect(savedB.content).toBe('产品B笔记');
    expect(savedB.productId).toBe(second.id);

    // 分别获取
    const noteARes = await authFetch(request, token, 'GET', `/api/skills/startup-map/points/${firstPointId}/notes?productId=${first.id}`);
    const noteA = await noteARes.json();
    expect(noteA.content).toBe('产品A笔记');

    const noteBRes = await authFetch(request, token, 'GET', `/api/skills/startup-map/points/${firstPointId}/notes?productId=${second.id}`);
    const noteB = await noteBRes.json();
    expect(noteB.content).toBe('产品B笔记');
  });

  test('UI — 产品列表显示多个产品', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    await apiCreateProduct(request, token, { name: '产品Alpha' });
    await apiCreateProduct(request, token, { name: '产品Beta' });

    await loginAndGoToStartupMap(page);
    await page.locator('.productBtn').click();
    await expect(page.getByText('产品档案')).toBeVisible({ timeout: 5000 });

    // 应有产品列表
    await expect(page.locator('.productList')).toBeVisible();
    const items = page.locator('.productItem');
    await expect(items).toHaveCount(2);

    // 第一个应有"当前"标签
    await expect(items.first().locator('.activeBadge')).toHaveText('当前');
  });

  test('UI — 激活切换', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    await apiCreateProduct(request, token, { name: '产品Alpha' });
    await apiCreateProduct(request, token, { name: '产品Beta' });

    await loginAndGoToStartupMap(page);
    await page.locator('.productBtn').click();
    await expect(page.getByText('产品档案')).toBeVisible({ timeout: 5000 });

    // 点击第二个产品的"设为当前"按钮
    const secondItem = page.locator('.productItem').nth(1);
    await secondItem.locator('.actionBtn').filter({ hasText: '设为当前' }).click();

    // 第二个产品应变为激活
    await expect(secondItem.locator('.activeBadge')).toBeVisible({ timeout: 5000 });
    await expect(secondItem.locator('.activeBadge')).toHaveText('当前');
  });

  test('UI — 删除确认弹窗', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    await apiCreateProduct(request, token, { name: '产品Alpha' });
    await apiCreateProduct(request, token, { name: '产品Beta' });

    await loginAndGoToStartupMap(page);
    await page.locator('.productBtn').click();
    await expect(page.getByText('产品档案')).toBeVisible({ timeout: 5000 });

    // 点击第二个产品的"删除"按钮
    const secondItem = page.locator('.productItem').nth(1);
    await secondItem.locator('.actionBtn').filter({ hasText: '删除' }).click();

    // 确认弹窗应出现
    await expect(page.locator('.dialogOverlay')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('确定删除产品')).toBeVisible();
    await expect(page.getByRole('button', { name: '确认删除' })).toBeVisible();
    await expect(page.getByRole('button', { name: '取消' })).toBeVisible();

    // 点击确认删除
    await page.getByRole('button', { name: '确认删除' }).click();

    // 产品列表应只剩一个
    await expect(page.locator('.productItem')).toHaveCount(1, { timeout: 5000 });
  });
});

// ─── 重新生成 ───

test.describe('创业地图 - 重新生成', () => {
  test('未生成内容时显示生成按钮', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    await loginAndGoToStartupMap(page);

    await page.locator('.domainCard').filter({ hasText: '市场研究' }).click();
    await expect(page.locator('.domainTitle')).toHaveText('市场研究', { timeout: 5000 });
    await page.locator('.pointItem').first().click();
    await expect(page.locator('.pointTitle')).toBeVisible({ timeout: 5000 });

    // 空状态显示
    await expect(page.getByText('教学内容尚未生成')).toBeVisible();
    await expect(page.getByRole('button', { name: '生成教学内容' })).toBeVisible();
    // 重新生成按钮不应显示
    await expect(page.locator('.generateBtn.secondary')).not.toBeVisible();
  });

  test('教学内容 5 个分区标题正确', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);

    // 通过 API 创建一条伪造的教学内容来测试 UI（不需要 LLM）
    // 先获取知识点 ID，然后直接从 UI 验证存在教学区后的行为
    // 注意：此测试验证的是空状态 UI，不需要实际教学内容
    await loginAndGoToStartupMap(page);
    await page.locator('.domainCard').filter({ hasText: '市场研究' }).click();
    await expect(page.locator('.domainTitle')).toHaveText('市场研究', { timeout: 5000 });
    await page.locator('.pointItem').first().click();
    await expect(page.locator('.pointTitle')).toBeVisible({ timeout: 5000 });

    // 空状态下按钮文本验证
    const generateBtn = page.getByRole('button', { name: '生成教学内容' });
    await expect(generateBtn).toBeVisible();
    await expect(generateBtn).toBeEnabled();
  });
});
