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
  const res = await request.post('/api/auth/login', { data: TEST_USER });
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
  const res = await authFetch(request, token, 'POST', '/api/startup-map/seed');
  return res.json();
}

/** 登录并导航到创业地图页面 */
async function loginAndGoToStartupMap(page: Page) {
  await page.goto('/login');
  await page.waitForSelector('.login-form', { timeout: 10000 });
  await page.fill('#username', TEST_USER.username);
  await page.fill('#password', TEST_USER.password);
  await page.click('.submit-btn');
  await page.waitForURL('**/habit-tracker', { timeout: 10000 });
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
  const res = await authFetch(request, token, 'PATCH', `/api/startup-map/points/${pointId}/status`, { status });
  return res.json();
}

/** 获取第一个领域的详情（含知识点） */
async function getFirstDomainDetail(request: APIRequestContext, token: string) {
  const domainsRes = await authFetch(request, token, 'GET', '/api/startup-map/domains');
  const domains = await domainsRes.json();
  const domainId = domains[0].id;
  const detailRes = await authFetch(request, token, 'GET', `/api/startup-map/domains/${domainId}`);
  return detailRes.json();
}

// ─── 种子数据初始化 ───

test.describe('创业地图 - 种子数据', () => {
  test('POST /api/startup-map/seed 成功创建知识树', async ({ request }) => {
    const token = await getAuthToken(request);
    const result = await seedKnowledgeTree(request, token);
    expect(result.success).toBe(true);

    // 验证 10 个领域
    const domainsRes = await authFetch(request, token, 'GET', '/api/startup-map/domains');
    const domains = await domainsRes.json();
    expect(domains).toHaveLength(10);
  });

  test('重复执行 seed 不产生重复数据', async ({ request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    const result = await seedKnowledgeTree(request, token);
    expect(result.skipped).toBe(true);

    const domainsRes = await authFetch(request, token, 'GET', '/api/startup-map/domains');
    const domains = await domainsRes.json();
    expect(domains).toHaveLength(10);
  });

  test('种子数据包含正确的领域名称', async ({ request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);

    const domainsRes = await authFetch(request, token, 'GET', '/api/startup-map/domains');
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

    const domainsRes = await authFetch(request, token, 'GET', '/api/startup-map/domains');
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
    await expect(page.getByText('请先初始化种子数据')).toBeVisible();
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
    const pointRes = await authFetch(request, token, 'GET', `/api/startup-map/points/${firstPointId}`);
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

    const chatsRes = await authFetch(request, token, 'GET', `/api/startup-map/points/${firstPointId}/chats`);
    const chats = await chatsRes.json();
    expect(chats).toHaveLength(0);
  });

  test('API 层 — DELETE chats 成功', async ({ request }) => {
    const token = await getAuthToken(request);
    await seedKnowledgeTree(request, token);
    const domain = await getFirstDomainDetail(request, token);
    const firstPointId = domain.topics[0].points[0].id;

    const res = await authFetch(request, token, 'DELETE', `/api/startup-map/points/${firstPointId}/chats`);
    expect(res.ok()).toBe(true);
  });
});

// ─── 导航 ───

test.describe('创业地图 - 导航', () => {
  test('侧边栏显示创业地图入口', async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('.login-form', { timeout: 10000 });
    await page.fill('#username', TEST_USER.username);
    await page.fill('#password', TEST_USER.password);
    await page.click('.submit-btn');
    await page.waitForURL('**/habit-tracker', { timeout: 10000 });

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

    const statsRes = await authFetch(request, token, 'GET', '/api/startup-map/stats/overview');
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

    const statsRes = await authFetch(request, token, 'GET', '/api/startup-map/stats/overview');
    const stats = await statsRes.json();

    expect(stats.completedCount).toBe(1);
    expect(stats.completionRate).toBeGreaterThan(0);
  });
});
