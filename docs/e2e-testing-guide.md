# E2E Testing Guide

本项目使用 Playwright 进行端到端测试。本文档总结了标准模式、常见坑和最佳实践，供新工具编写 E2E 测试时参考。

## 运行测试

```bash
# 运行所有测试（自动启动 dev server）
npx playwright test

# 运行单个文件
npx playwright test e2e/startup-map.spec.ts

# 按名称过滤
npx playwright test -g "种子数据"

# 带详细输出
npx playwright test e2e/startup-map.spec.ts --reporter=list
```

配置文件 `playwright.config.ts`：timeout 30s，workers 1，baseURL `http://localhost:3000`，webServer 会自动 `npm run dev`（reuseExistingServer: true）。

## 文件结构

```
e2e/
├── habit-tracker.spec.ts
├── annual-planner.spec.ts
├── article-reader.spec.ts
└── startup-map.spec.ts       # 每个工具一个文件
```

命名规范：`<tool-id>.spec.ts`，与 `tools/<tool-id>/` 目录对齐。

## 标准模板

```typescript
import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

// ─── 认证常量 ───
const TEST_USER = { username: 'testuser', password: 'testpass123' };

// ─── beforeEach: reset + seed user ───
test.beforeEach(async ({ request }) => {
  // 1. 清空所有数据（调用 _test/reset）
  await request.post('/api/_test/reset');
  // 2. 创建测试用户（需要认证的工具必须加这一步）
  await request.post('/api/_test/seed-user', { data: TEST_USER });
});

// ─── 工具函数 ───

/** 通过 API 登录获取 JWT token */
async function getAuthToken(request: APIRequestContext): Promise<string> {
  const res = await request.post('/api/auth/login', { data: TEST_USER });
  const body = await res.json();
  return body.token;
}

/** 带认证的 API 调用 */
async function authFetch(
  request: APIRequestContext,
  token: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  data?: Record<string, unknown>,
) {
  const options: Record<string, unknown> = {
    headers: { Authorization: `Bearer ${token}` },
  };
  if (data) options.data = data;

  switch (method) {
    case 'GET':    return request.get(url, options);
    case 'POST':   return request.post(url, options);
    case 'PUT':    return request.put(url, options);
    case 'PATCH':  return request.patch(url, options);
    case 'DELETE': return request.delete(url, options);
  }
}

/** 登录并导航到目标工具页面 */
async function loginAndGoToTool(page: Page) {
  await page.goto('/login');
  await page.waitForSelector('.login-form', { timeout: 10000 });
  await page.fill('#username', TEST_USER.username);
  await page.fill('#password', TEST_USER.password);
  await page.click('.submit-btn');
  await page.waitForURL('**/habit-tracker', { timeout: 10000 });
  // 导航到目标页面
  await page.goto('/your-tool-id');
  // 等待页面内容加载
  await page.waitForFunction(
    () => {
      const body = document.body.textContent || '';
      return body.includes('某个标志性文字');
    },
    { timeout: 10000 },
  );
}

// ─── 测试用例 ───

test.describe('工具名 - 模块名', () => {
  test('测试描述', async ({ page, request }) => {
    const token = await getAuthToken(request);
    // seed 数据 ...
    await loginAndGoToTool(page);
    // 断言 ...
  });
});
```

## 认证处理

### 核心要点

本项目所有 `/api/*` 路由（除 `/api/_test/*` 和 `POST /api/auth/login`）都需要 JWT 认证。

**API 测试**需要先获取 token，再通过 `Authorization: Bearer <token>` header 发送请求：

```typescript
const token = await getAuthToken(request);
const res = await authFetch(request, token, 'GET', '/api/your-endpoint');
```

**UI 测试**需要先通过登录表单登录，然后再导航到目标页面。SPA 会在登录成功后将 token 存入 localStorage，后续的 `$fetch` 调用自动附带 token。

### beforeEach 标准流程

```
reset → seed-user → (每个 test 内) getAuthToken / loginAndGoToTool
```

**为什么不能跳过 seed-user？** `_test/reset` 会清空 `users` 表，没有用户就无法登录。

**为什么 `_test/*` 不需要 token？** Auth middleware 白名单了 `/api/_test/` 路径。

### 常见错误

| 现象 | 原因 | 解决 |
|------|------|------|
| API 返回 401 | 没带 token 或 token 过期 | 用 `authFetch()` 包装所有 API 调用 |
| 页面显示登录表单 | 没有登录就 `page.goto('/tool')` | 先调用 `loginAndGoToTool()` |
| `waitForURL` 超时 | 登录凭证错误或 seed-user 没调用 | 检查 beforeEach 有没有 seed-user |

## 选择器最佳实践

### 推荐的选择器策略

按优先级排序：

1. **CSS class 选择器**（scoped class 在 Playwright 中可用）
   ```typescript
   page.locator('.domainCard')
   page.locator('.statusBadge')
   ```

2. **getByRole**（语义化选择器）
   ```typescript
   page.getByRole('button', { name: '保存' })
   page.getByRole('link', { name: '创业地图' })
   ```

3. **getByText + filter**
   ```typescript
   page.locator('.statCard').filter({ hasText: '已完成' })
   page.locator('.domainCard').filter({ hasText: '市场研究' })
   ```

4. **id 选择器**（表单字段）
   ```typescript
   page.locator('#productName')
   page.locator('#currentStage')
   ```

5. **getByPlaceholder**
   ```typescript
   page.getByPlaceholder('输入问题...')
   ```

### 需要避免的

- **`getByText('文字')` 单独使用** — 如果页面有多个匹配元素会触发 strict mode violation
  ```typescript
  // BAD: 可能匹配侧边栏和 tab 两个元素
  page.getByText('创业地图')

  // GOOD: 用 getByRole 限定
  page.getByRole('link', { name: '创业地图' })
  ```

- **硬编码的 data-testid** — 本项目不使用 data-testid，用 CSS class 和语义化选择器

## 等待策略

### 页面导航后等待

用 `waitForFunction` 检查页面文本内容，而不是等待特定元素：

```typescript
await page.waitForFunction(
  () => {
    const body = document.body.textContent || '';
    return body.includes('关键文字A') || body.includes('关键文字B');
  },
  { timeout: 10000 },
);
```

### 异步操作后等待

用 `toBeVisible({ timeout })` 或 `toHaveText(text, { timeout })` 等待元素出现/更新：

```typescript
// 等待状态切换
await page.locator('.statusBtn').filter({ hasText: '学习中' }).click();
await expect(page.locator('.statusBtn').filter({ hasText: '学习中' }))
  .toHaveClass(/active/, { timeout: 5000 });
```

### 不要用

- `page.waitForTimeout(ms)` — 硬等待不可靠
- `page.waitForSelector('.class')` — 不如 `expect(locator).toBeVisible()` 语义清晰

## 测试组织

### describe 分组

按功能模块分组，每个 describe 块覆盖一个用户流程：

```typescript
test.describe('工具名 - 种子数据', () => { ... });
test.describe('工具名 - 列表视图', () => { ... });
test.describe('工具名 - 详情页', () => { ... });
test.describe('工具名 - CRUD 操作', () => { ... });
test.describe('工具名 - 导航', () => { ... });
test.describe('工具名 - 数据持久化', () => { ... });
```

### API 层测试 vs UI 测试

同一个 describe 内混合 API 测试和 UI 测试：

- **API 测试**：不需要 `page`，只用 `request` + `authFetch`。速度快，验证数据逻辑。
- **UI 测试**：需要 `page` + `loginAndGoToTool`。验证用户交互和视觉反馈。

```typescript
test.describe('产品档案', () => {
  // UI 测试
  test('创建产品档案', async ({ page, request }) => { ... });

  // API 测试
  test('API 层 — 创建产品返回正确结构', async ({ request }) => {
    const token = await getAuthToken(request);
    const res = await authFetch(request, token, 'POST', '/api/endpoint', { ... });
    // 断言 ...
  });
});
```

### 辅助函数命名

| 函数 | 用途 |
|------|------|
| `getAuthToken(request)` | 获取 JWT token |
| `authFetch(request, token, method, url, data?)` | 带认证的 API 调用 |
| `loginAndGoToTool(page)` | 登录 + 导航到工具页面 |
| `seedXxx(request, token)` | 通过 API 创建种子数据 |
| `apiCreateXxx(request, token, data)` | 通过 API 创建实体 |
| `apiUpdateXxx(request, token, id, data)` | 通过 API 更新实体 |
| `getFirstXxx(request, token)` | 获取第一条数据用于后续测试 |

## 踩坑记录

### 1. API 返回格式要先验证

**问题**：假设 seed API 返回 `{ inserted: true }`，实际返回 `{ success: true, counts: {...} }`。

**教训**：写测试前先阅读 API handler 源码（`server/api/` 目录），确认返回的 JSON 结构。或者先用 `console.log(await res.json())` 打印确认。

### 2. 所有业务 API 都需要认证

**问题**：第一版测试直接调 `request.post('/api/startup-map/seed')` 没带 token，全部返回 401。

**教训**：除了 `/api/_test/*` 和 `POST /api/auth/login`，所有 API 调用必须带 `Authorization: Bearer <token>` header。永远使用 `authFetch()` 封装。

### 3. SPA 认证会重定向到登录页

**问题**：`page.goto('/startup-map')` 后页面显示的是登录表单，不是工具页面。`waitForFunction` 超时。

**教训**：`plugins/auth.client.ts` 会在无 token 时自动重定向到 `/login`。UI 测试必须先通过登录表单登录，让 SPA 获得 token 后再导航到目标页面。

### 4. getByText strict mode violation

**问题**：`page.getByText('创业地图')` 匹配到了侧边栏和页面 tab 两个元素，Playwright 抛出 strict mode violation。

**教训**：用更精确的选择器。优先用 `getByRole`（如 `getByRole('link', { name: '创业地图' })`），或用 `.filter()` / `.nth()` 限定范围。

### 5. 引用不存在的 API 端点

**问题**：测试引用了 `/api/startup-map/stats/overview`，但端点还没实现。

**教训**：写测试前列出所有需要的 API 端点，和后端确认已实现。用 `ls server/api/<tool>/` 检查文件是否存在。

### 6. 种子数据的幂等性

**问题**：seed 端点第一次调用返回 `{ success, counts }`，第二次返回 `{ success, skipped: true }`，两种响应格式不同。

**教训**：如果 API 有多种响应路径，每种都要测试。幂等性测试是种子数据的必备测试。

### 7. beforeEach reset 清空用户表

**问题**：reset 会清空包括 users 在内的所有表，但早期的 annual-planner 测试没有 seed-user 步骤。

**教训**：需要认证的工具，beforeEach 必须同时 reset + seed-user。不需要认证的工具（如早期 annual-planner）可以只 reset，但建议统一加 seed-user 以防后续加上认证。

## Checklist

为新工具编写 E2E 测试时的检查清单：

- [ ] 文件命名 `e2e/<tool-id>.spec.ts`
- [ ] `beforeEach` 有 `reset` + `seed-user`
- [ ] 有 `getAuthToken` 和 `authFetch` 辅助函数
- [ ] 有 `loginAndGoToTool` 辅助函数
- [ ] API 测试全部使用 `authFetch` 包装
- [ ] UI 测试全部先登录再导航
- [ ] 选择器没有 strict mode violation 风险
- [ ] 异步操作后有适当的 `timeout` 等待
- [ ] 种子数据有幂等性测试
- [ ] 空状态有对应测试
- [ ] 数据持久化有刷新后验证
- [ ] 所有引用的 API 端点确认存在
