import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

// ─── 认证常量 ───
const TEST_USER = { username: 'testuser', password: 'testpass123' };

// ─── 每个测试前重置数据库并创建测试用户 ───
test.beforeEach(async ({ request }) => {
  await request.post('/api/_test/reset');
  await request.post('/api/_test/seed-user', { data: TEST_USER });
});

// ─── 工具函数 ───

/** 登录并导航到文章阅读器页面 */
async function loginAndGotoReader(page: Page, request: APIRequestContext) {
  await page.goto('/login');
  await page.waitForSelector('.login-form', { timeout: 10000 });
  await page.fill('#username', TEST_USER.username);
  await page.fill('#password', TEST_USER.password);
  await page.click('.submit-btn');
  await page.waitForURL('**/habit-tracker', { timeout: 10000 });
  await page.goto('/article-reader');
  await page.waitForFunction(
    () => {
      const body = document.body.textContent || '';
      return body.includes('文章阅读') || body.includes('阅读') || body.includes('粘贴文章');
    },
    { timeout: 10000 },
  );
}

/** 登录并导航到首页（用于侧边栏测试） */
async function loginAndGotoHome(page: Page) {
  await page.goto('/login');
  await page.waitForSelector('.login-form', { timeout: 10000 });
  await page.fill('#username', TEST_USER.username);
  await page.fill('#password', TEST_USER.password);
  await page.click('.submit-btn');
  await page.waitForURL('**/habit-tracker', { timeout: 10000 });
}

/** 通过 API 种入一篇测试文章 */
async function seedArticle(
  request: APIRequestContext,
  overrides: Record<string, unknown> = {},
) {
  const res = await request.post('/api/_test/seed-article', {
    data: {
      url: 'https://example.com/test-article',
      title: 'E2E Test Article: Understanding TypeScript',
      author: 'John Doe',
      siteName: 'techblog.com',
      content: '<h2>Introduction</h2><p>TypeScript is a typed superset of JavaScript.</p><p>It compiles to plain JavaScript.</p>',
      excerpt: 'TypeScript is a typed superset of JavaScript that compiles to plain JavaScript.',
      publishedAt: Date.now() - 86_400_000,
      ...overrides,
    },
  });
  return res.json();
}

/** 种入一篇带翻译的文章 */
async function seedArticleWithTranslations(
  request: APIRequestContext,
  overrides: Record<string, unknown> = {},
) {
  return seedArticle(request, {
    fullTranslation: '## 简介\n\nTypeScript 是 JavaScript 的类型超集。\n\n它可以编译为纯 JavaScript。',
    summaryTranslation: '**要点：**\n\n1. TypeScript 是 JavaScript 的类型超集\n2. 它可以编译为纯 JavaScript\n3. 提供更好的开发体验\n\n**总结：** TypeScript 通过添加类型系统增强了 JavaScript 的开发体验。',
    ...overrides,
  });
}

/** 种入一篇已收藏的文章 */
async function seedBookmarkedArticle(
  request: APIRequestContext,
  overrides: Record<string, unknown> = {},
) {
  return seedArticleWithTranslations(request, {
    bookmarked: true,
    ...overrides,
  });
}

/** 加载已种入的文章到阅读视图 */
async function loadArticle(page: Page, url: string) {
  await page.getByPlaceholder('粘贴文章 URL ...').fill(url);
  await page.getByRole('button', { name: '加载' }).click();
}

// ─── 导航与工具注册 ───

test.describe('文章阅读器 - 导航与注册', () => {
  test('侧边栏显示文章阅读入口', async ({ page }) => {
    await loginAndGotoHome(page);
    await expect(page.getByRole('link', { name: '文章阅读' })).toBeVisible();
  });

  test('点击侧边栏跳转到文章阅读器', async ({ page }) => {
    await loginAndGotoHome(page);
    await page.getByRole('link', { name: '文章阅读' }).click();
    await expect(page).toHaveURL(/\/article-reader/);
  });

  test('直接访问 /article-reader 路由', async ({ page, request }) => {
    await loginAndGotoReader(page, request);
    await expect(page).toHaveURL(/\/article-reader/);
    const readingTab = page.getByRole('button', { name: '阅读' });
    await expect(readingTab).toBeVisible();
  });
});

// ─── 空状态 ───

test.describe('文章阅读器 - 空状态', () => {
  test('未加载文章时显示空状态提示', async ({ page, request }) => {
    await loginAndGotoReader(page, request);
    await expect(page.getByText('粘贴文章链接开始阅读')).toBeVisible();
    await expect(page.getByText('支持大多数新闻、博客、技术文章网站')).toBeVisible();
  });

  test('URL 输入框存在且可聚焦', async ({ page, request }) => {
    await loginAndGotoReader(page, request);
    const input = page.getByPlaceholder('粘贴文章 URL ...');
    await expect(input).toBeVisible();
    await expect(input).toBeFocused();
  });

  test('空 URL 时加载按钮禁用', async ({ page, request }) => {
    await loginAndGotoReader(page, request);
    const fetchBtn = page.getByRole('button', { name: '加载' });
    await expect(fetchBtn).toBeDisabled();
  });
});

// ─── URL 输入与文章加载 ───

test.describe('文章阅读器 - 文章加载', () => {
  test('输入 URL 后加载按钮启用', async ({ page, request }) => {
    await loginAndGotoReader(page, request);
    await page.getByPlaceholder('粘贴文章 URL ...').fill('https://example.com/article');
    const fetchBtn = page.getByRole('button', { name: '加载' });
    await expect(fetchBtn).toBeEnabled();
  });

  test('加载已种入的文章后展示分屏视图', async ({ page, request }) => {
    const article = await seedArticle(request);
    await loginAndGotoReader(page, request);

    await loadArticle(page, article.url);

    // 等待文章加载完成 — 标题应在左侧面板出现
    await expect(page.getByText('E2E Test Article: Understanding TypeScript')).toBeVisible({ timeout: 10000 });

    // 验证分屏布局出现
    await expect(page.getByText('Introduction')).toBeVisible();
    await expect(page.getByText('TypeScript is a typed superset of JavaScript.')).toBeVisible();

    // 文章元信息
    await expect(page.getByText('techblog.com')).toBeVisible();
    await expect(page.getByText('John Doe')).toBeVisible();
  });

  test('加载同一 URL 不创建重复记录', async ({ page, request }) => {
    const article = await seedArticle(request);
    await loginAndGotoReader(page, request);

    await loadArticle(page, article.url);
    await expect(page.getByText('E2E Test Article: Understanding TypeScript')).toBeVisible({ timeout: 10000 });

    // 重新加载相同 URL
    const input = page.getByPlaceholder('粘贴文章 URL ...');
    await input.clear();
    await loadArticle(page, article.url);

    // 应该还是同一篇文章（无错误）
    await expect(page.getByText('E2E Test Article: Understanding TypeScript')).toBeVisible();
  });

  test('加载按钮在请求中显示加载状态', async ({ page, request }) => {
    const article = await seedArticle(request);
    await loginAndGotoReader(page, request);

    await page.getByPlaceholder('粘贴文章 URL ...').fill(article.url);
    await page.getByRole('button', { name: '加载' }).click();

    // 按钮文字应变为「加载中...」
    await expect(page.getByRole('button', { name: '加载中...' })).toBeVisible();

    // 等待加载完成
    await expect(page.getByText('E2E Test Article: Understanding TypeScript')).toBeVisible({ timeout: 10000 });
  });
});

// ─── 原文面板 ───

test.describe('文章阅读器 - 原文面板', () => {
  test('渲染文章标题和元信息', async ({ page, request }) => {
    const article = await seedArticle(request);
    await loginAndGotoReader(page, request);

    await loadArticle(page, article.url);

    await expect(page.getByRole('heading', { name: 'E2E Test Article: Understanding TypeScript' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('techblog.com')).toBeVisible();
    await expect(page.getByText('John Doe')).toBeVisible();
  });

  test('渲染 HTML 正文结构', async ({ page, request }) => {
    const article = await seedArticle(request, {
      content: '<h2>Chapter 1</h2><p>First paragraph.</p><ul><li>Item A</li><li>Item B</li></ul><p>Last paragraph.</p>',
    });
    await loginAndGotoReader(page, request);

    await loadArticle(page, article.url);

    await expect(page.getByText('Chapter 1')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('First paragraph.')).toBeVisible();
    await expect(page.getByText('Item A')).toBeVisible();
    await expect(page.getByText('Item B')).toBeVisible();
    await expect(page.getByText('Last paragraph.')).toBeVisible();
  });
});

// ─── 翻译面板 ───

test.describe('文章阅读器 - 翻译与概括', () => {
  test('右侧面板默认显示完整翻译 tab', async ({ page, request }) => {
    const article = await seedArticle(request);
    await loginAndGotoReader(page, request);

    await loadArticle(page, article.url);
    await expect(page.getByText('E2E Test Article: Understanding TypeScript')).toBeVisible({ timeout: 10000 });

    await expect(page.getByRole('button', { name: '完整翻译' })).toBeVisible();
    await expect(page.getByRole('button', { name: '精简概括' })).toBeVisible();
  });

  test('未翻译时显示翻译触发按钮', async ({ page, request }) => {
    const article = await seedArticle(request);
    await loginAndGotoReader(page, request);

    await loadArticle(page, article.url);
    await expect(page.getByText('E2E Test Article: Understanding TypeScript')).toBeVisible({ timeout: 10000 });

    await expect(page.getByRole('button', { name: '翻译全文' })).toBeVisible();
    await expect(page.getByRole('button', { name: '两者都要' })).toBeVisible();
  });

  test('已有翻译缓存时直接显示内容', async ({ page, request }) => {
    const article = await seedArticleWithTranslations(request);
    await loginAndGotoReader(page, request);

    await loadArticle(page, article.url);
    await expect(page.getByText('E2E Test Article: Understanding TypeScript')).toBeVisible({ timeout: 10000 });

    // 完整翻译应已直接展示（有缓存）
    await expect(page.getByText('TypeScript 是 JavaScript 的类型超集')).toBeVisible({ timeout: 5000 });
  });

  test('切换到精简概括 tab 显示概括内容', async ({ page, request }) => {
    const article = await seedArticleWithTranslations(request);
    await loginAndGotoReader(page, request);

    await loadArticle(page, article.url);
    await expect(page.getByText('E2E Test Article: Understanding TypeScript')).toBeVisible({ timeout: 10000 });

    // 切换到精简概括 tab
    await page.getByRole('button', { name: '精简概括' }).click();

    // 概括内容应出现
    await expect(page.getByText('提供更好的开发体验')).toBeVisible({ timeout: 5000 });
  });

  test('tab 切换不丢失另一个 tab 的内容', async ({ page, request }) => {
    const article = await seedArticleWithTranslations(request);
    await loginAndGotoReader(page, request);

    await loadArticle(page, article.url);
    await expect(page.getByText('E2E Test Article: Understanding TypeScript')).toBeVisible({ timeout: 10000 });

    // 验证完整翻译
    await expect(page.getByText('TypeScript 是 JavaScript 的类型超集')).toBeVisible({ timeout: 5000 });

    // 切换到精简概括
    await page.getByRole('button', { name: '精简概括' }).click();
    await expect(page.getByText('提供更好的开发体验')).toBeVisible({ timeout: 5000 });

    // 切回完整翻译，内容应仍在
    await page.getByRole('button', { name: '完整翻译' }).click();
    await expect(page.getByText('TypeScript 是 JavaScript 的类型超集')).toBeVisible();
  });
});

// ─── 收藏功能 ───

test.describe('文章阅读器 - 收藏', () => {
  test('文章加载后收藏按钮可见', async ({ page, request }) => {
    const article = await seedArticle(request);
    await loginAndGotoReader(page, request);

    await loadArticle(page, article.url);
    await expect(page.getByText('E2E Test Article: Understanding TypeScript')).toBeVisible({ timeout: 10000 });

    await expect(page.getByRole('button', { name: '收藏', exact: true })).toBeVisible();
  });

  test('未加载文章时不显示收藏按钮', async ({ page, request }) => {
    await loginAndGotoReader(page, request);

    // 不应有收藏/取消收藏按钮（bookmarkBtn 只在 currentArticle 有值时渲染）
    await expect(page.locator('.bookmarkBtn')).not.toBeVisible();
  });

  test('点击收藏后变为取消收藏', async ({ page, request }) => {
    const article = await seedArticle(request);
    await loginAndGotoReader(page, request);

    await loadArticle(page, article.url);
    await expect(page.getByText('E2E Test Article: Understanding TypeScript')).toBeVisible({ timeout: 10000 });

    // 点击收藏
    await page.getByRole('button', { name: '收藏', exact: true }).click();

    // 按钮应变为「取消收藏」
    await expect(page.getByRole('button', { name: '取消收藏' })).toBeVisible({ timeout: 5000 });
  });

  test('点击取消收藏后恢复为收藏', async ({ page, request }) => {
    const article = await seedBookmarkedArticle(request);
    await loginAndGotoReader(page, request);

    await loadArticle(page, article.url);
    await expect(page.getByText('E2E Test Article: Understanding TypeScript')).toBeVisible({ timeout: 10000 });

    // 已收藏的文章应显示「取消收藏」
    await expect(page.getByRole('button', { name: '取消收藏' })).toBeVisible({ timeout: 5000 });

    // 点击取消收藏
    await page.getByRole('button', { name: '取消收藏' }).click();

    // 应恢复为「收藏」
    await expect(page.getByRole('button', { name: '收藏', exact: true })).toBeVisible({ timeout: 5000 });
  });

  test('收藏状态重新加载后保持', async ({ page, request }) => {
    const article = await seedArticle(request);
    await loginAndGotoReader(page, request);

    await loadArticle(page, article.url);
    await expect(page.getByText('E2E Test Article: Understanding TypeScript')).toBeVisible({ timeout: 10000 });

    // 收藏
    await page.getByRole('button', { name: '收藏', exact: true }).click();
    await expect(page.getByRole('button', { name: '取消收藏' })).toBeVisible({ timeout: 5000 });

    // 重新加载同一文章
    const input = page.getByPlaceholder('粘贴文章 URL ...');
    await input.clear();
    await loadArticle(page, article.url);

    // 收藏状态应保持
    await expect(page.getByRole('button', { name: '取消收藏' })).toBeVisible({ timeout: 5000 });
  });
});

// ─── 收藏列表 ───

test.describe('文章阅读器 - 收藏列表', () => {
  test('无收藏时显示空状态', async ({ page, request }) => {
    await loginAndGotoReader(page, request);

    await page.getByRole('button', { name: '收藏库' }).click();

    await expect(page.getByText('还没有收藏的文章')).toBeVisible();
    await expect(page.getByText('阅读文章时点击收藏按钮即可添加')).toBeVisible();
  });

  test('收藏库显示已收藏的文章', async ({ page, request }) => {
    await seedBookmarkedArticle(request, {
      title: 'Bookmarked Article One',
      url: 'https://example.com/article-1',
    });
    await loginAndGotoReader(page, request);

    await page.getByRole('button', { name: '收藏库' }).click();

    await expect(page.getByText('Bookmarked Article One')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('techblog.com')).toBeVisible();
  });

  test('收藏库显示多篇文章按收藏时间倒序', async ({ page, request }) => {
    const now = Date.now();

    await seedBookmarkedArticle(request, {
      title: 'First Article (Older)',
      url: 'https://example.com/article-1',
      bookmarkedAt: now - 100_000,
    });

    await seedBookmarkedArticle(request, {
      title: 'Second Article (Newer)',
      url: 'https://example.com/article-2',
      bookmarkedAt: now,
    });

    await loginAndGotoReader(page, request);

    await page.getByRole('button', { name: '收藏库' }).click();

    await expect(page.getByText('Second Article (Newer)')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('First Article (Older)')).toBeVisible();

    // 较新的应在前面（倒序）
    const cards = page.locator('.bookmarkCard');
    await expect(cards).toHaveCount(2);

    const firstCardText = await cards.first().textContent();
    expect(firstCardText).toContain('Second Article (Newer)');

    // 总数提示
    await expect(page.getByText('共 2 篇收藏')).toBeVisible();
  });

  test('收藏库卡片显示摘要', async ({ page, request }) => {
    await seedBookmarkedArticle(request, {
      title: 'Article With Excerpt',
      url: 'https://example.com/article-excerpt',
      excerpt: 'This is a long excerpt that should be visible on the card.',
    });
    await loginAndGotoReader(page, request);

    await page.getByRole('button', { name: '收藏库' }).click();

    await expect(page.getByText('This is a long excerpt that should be visible on the card.')).toBeVisible({ timeout: 5000 });
  });

  test('点击收藏卡片跳转到阅读视图', async ({ page, request }) => {
    await seedBookmarkedArticle(request, {
      title: 'Click To Read Article',
      url: 'https://example.com/click-to-read',
    });
    await loginAndGotoReader(page, request);

    await page.getByRole('button', { name: '收藏库' }).click();

    // 点击卡片
    await page.getByText('Click To Read Article').click();

    // 应切换到阅读视图，显示文章内容
    await expect(page.getByRole('heading', { name: 'Click To Read Article' })).toBeVisible({ timeout: 10000 });
    // v-html 渲染的内容在 <p> 标签内
    await expect(page.locator('.articleContent')).toBeVisible();

    // 应回到阅读 tab
    const readingTab = page.getByRole('button', { name: '阅读' });
    const readingClasses = await readingTab.getAttribute('class');
    expect(readingClasses).toContain('active');
  });

  test('点击收藏卡片后显示已缓存的翻译', async ({ page, request }) => {
    await seedBookmarkedArticle(request, {
      title: 'Article With Translations',
      url: 'https://example.com/with-trans',
    });
    await loginAndGotoReader(page, request);

    await page.getByRole('button', { name: '收藏库' }).click();
    await page.getByText('Article With Translations').click();

    await expect(page.getByRole('heading', { name: 'Article With Translations' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('TypeScript 是 JavaScript 的类型超集')).toBeVisible({ timeout: 5000 });
  });

  test('收藏后收藏库中出现新文章', async ({ page, request }) => {
    const article = await seedArticle(request, {
      title: 'Newly Bookmarked',
      url: 'https://example.com/newly-bookmarked',
    });
    await loginAndGotoReader(page, request);

    await loadArticle(page, article.url);
    await expect(page.getByText('Newly Bookmarked')).toBeVisible({ timeout: 10000 });

    // 收藏
    await page.getByRole('button', { name: '收藏', exact: true }).click();
    await expect(page.getByRole('button', { name: '取消收藏' })).toBeVisible({ timeout: 5000 });

    // 切到收藏库
    await page.getByRole('button', { name: '收藏库' }).click();

    await expect(page.getByText('Newly Bookmarked')).toBeVisible({ timeout: 5000 });
  });
});

// ─── 视图切换 ───

test.describe('文章阅读器 - 视图切换', () => {
  test('阅读和收藏库 tab 可以切换', async ({ page, request }) => {
    await loginAndGotoReader(page, request);

    // 默认在阅读视图
    await expect(page.getByText('粘贴文章链接开始阅读')).toBeVisible();

    // 切到收藏库
    await page.getByRole('button', { name: '收藏库' }).click();
    await expect(page.getByText('还没有收藏的文章')).toBeVisible();

    // 切回阅读
    await page.getByRole('button', { name: '阅读' }).click();
    await expect(page.getByText('粘贴文章链接开始阅读')).toBeVisible();
  });

  test('阅读 tab 默认 active 样式', async ({ page, request }) => {
    await loginAndGotoReader(page, request);

    const readingTab = page.getByRole('button', { name: '阅读' });
    const classes = await readingTab.getAttribute('class');
    expect(classes).toContain('active');
  });

  test('切换到收藏库后 active 样式跟随', async ({ page, request }) => {
    await loginAndGotoReader(page, request);

    await page.getByRole('button', { name: '收藏库' }).click();

    const bookmarksTab = page.getByRole('button', { name: '收藏库' });
    const classes = await bookmarksTab.getAttribute('class');
    expect(classes).toContain('active');

    const readingTab = page.getByRole('button', { name: '阅读' });
    const readingClasses = await readingTab.getAttribute('class');
    expect(readingClasses).not.toContain('active');
  });
});
