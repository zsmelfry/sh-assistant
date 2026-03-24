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
  const res = await request.post('/api/auth/login', { data: TEST_USER });
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

/** Enable multi-wordbook feature via test endpoint */
async function enableMultiWordbook(request: APIRequestContext) {
  await request.post('/api/_test/set-vocab-setting', {
    data: { username: TEST_USER.username, key: 'multi_wordbook_enabled', value: 'true' },
  });
}

/** Import French CSV words via API (creates a wordbook in single-mode or adds in multi-mode) */
async function importFrenchWords(request: APIRequestContext, token: string, wordbookName?: string) {
  const csv = 'rank,french_word\n1,bonjour\n2,merci\n3,oui\n4,non\n5,salut';
  return authFetch(request, token, 'POST', '/api/vocab/words-import', {
    csv,
    language: 'fr',
    ...(wordbookName ? { wordbookName } : {}),
  });
}

/** Import English CSV words via API */
async function importEnglishWords(request: APIRequestContext, token: string, wordbookName?: string) {
  const csv = 'rank,word\n1,hello\n2,thanks\n3,yes';
  return authFetch(request, token, 'POST', '/api/vocab/words-import', {
    csv,
    language: 'en',
    ...(wordbookName ? { wordbookName } : {}),
  });
}

/** Login via form and navigate to vocab-tracker */
async function loginAndGoToVocab(page: Page) {
  await page.goto('/login');
  await page.waitForSelector('.login-form', { timeout: 10000 });
  await page.fill('#username', TEST_USER.username);
  await page.fill('#password', TEST_USER.password);
  await page.click('.submit-btn');
  await page.waitForURL('**/*', { timeout: 10000 });
  await page.goto('/vocab-tracker');
  await page.waitForFunction(
    () => {
      const body = document.body.textContent || '';
      return body.includes('词汇学习') || body.includes('词库为空') || body.includes('词汇列表');
    },
    { timeout: 10000 },
  );
}

// ─── 1. API Tests: Wordbook CRUD ───

test.describe('Wordbooks API - GET /api/vocab/wordbooks', () => {
  test('初始状态返回迁移创建的默认词汇本', async ({ request }) => {
    const token = await getAuthToken(request);
    const res = await authFetch(request, token, 'GET', '/api/vocab/wordbooks');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    // Migration 0028 seeds a default French wordbook
    expect(body.wordbooks).toHaveLength(1);
    expect(body.wordbooks[0].language).toBe('fr');
    expect(body.wordbooks[0].name).toBe('法语频率词');
    expect(body.wordbooks[0].isActive).toBe(true);
    expect(body.wordbooks[0].wordCount).toBe(0);
    expect(body.activeWordbookId).toBe(body.wordbooks[0].id);
    expect(body.multiWordbookEnabled).toBe(false);
  });

  test('导入后词汇本含正确词数', async ({ request }) => {
    const token = await getAuthToken(request);

    // Import replaces data in the existing default wordbook (single mode)
    await importFrenchWords(request, token);

    const res = await authFetch(request, token, 'GET', '/api/vocab/wordbooks');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    // Still only 1 wordbook (the default one, updated with imported words)
    expect(body.wordbooks).toHaveLength(1);
    expect(body.wordbooks[0].language).toBe('fr');
    expect(body.wordbooks[0].isActive).toBe(true);
    expect(body.wordbooks[0].wordCount).toBe(5);
    expect(body.activeWordbookId).toBe(body.wordbooks[0].id);
  });

  test('启用多词汇本后 multiWordbookEnabled=true', async ({ request }) => {
    const token = await getAuthToken(request);
    await enableMultiWordbook(request);

    const res = await authFetch(request, token, 'GET', '/api/vocab/wordbooks');
    const body = await res.json();
    expect(body.multiWordbookEnabled).toBe(true);
  });
});

test.describe('Wordbooks API - POST /api/vocab/wordbooks', () => {
  test('创建英语词汇本（multi_wordbook_enabled=true）', async ({ request }) => {
    const token = await getAuthToken(request);
    await enableMultiWordbook(request);

    const res = await authFetch(request, token, 'POST', '/api/vocab/wordbooks', {
      name: 'English Vocab',
      language: 'en',
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.name).toBe('English Vocab');
    expect(body.language).toBe('en');
    expect(body.isActive).toBe(true);
  });

  test('多词汇本未启用且已有词汇本时返回 403', async ({ request }) => {
    const token = await getAuthToken(request);

    // Migration already creates a default French wordbook,
    // so POST should be blocked without multi-wordbook enabled
    const res = await authFetch(request, token, 'POST', '/api/vocab/wordbooks', {
      name: 'English Vocab',
      language: 'en',
    });
    expect(res.status()).toBe(403);
  });

  test('无效语言代码返回 500', async ({ request }) => {
    const token = await getAuthToken(request);
    await enableMultiWordbook(request);

    const res = await authFetch(request, token, 'POST', '/api/vocab/wordbooks', {
      name: 'Invalid Language',
      language: 'zz',
    });
    // getLanguageConfig throws for unknown language codes
    expect(res.ok()).toBeFalsy();
  });

  test('缺少 name 返回 400', async ({ request }) => {
    const token = await getAuthToken(request);
    await enableMultiWordbook(request);

    const res = await authFetch(request, token, 'POST', '/api/vocab/wordbooks', {
      language: 'en',
    });
    expect(res.status()).toBe(400);
  });

  test('缺少 language 返回 400', async ({ request }) => {
    const token = await getAuthToken(request);
    await enableMultiWordbook(request);

    const res = await authFetch(request, token, 'POST', '/api/vocab/wordbooks', {
      name: 'Test',
    });
    expect(res.status()).toBe(400);
  });
});

test.describe('Wordbooks API - PUT /api/vocab/wordbooks/[id]', () => {
  test('重命名词汇本', async ({ request }) => {
    const token = await getAuthToken(request);

    // Import to create a wordbook
    await importFrenchWords(request, token);

    // Get the wordbook ID
    const listRes = await authFetch(request, token, 'GET', '/api/vocab/wordbooks');
    const { wordbooks: wbs } = await listRes.json();
    const wordbookId = wbs[0].id;

    // Rename
    const res = await authFetch(request, token, 'PUT', `/api/vocab/wordbooks/${wordbookId}`, {
      name: 'My French Words',
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.name).toBe('My French Words');
  });

  test('不存在的词汇本返回 404', async ({ request }) => {
    const token = await getAuthToken(request);
    const res = await authFetch(request, token, 'PUT', '/api/vocab/wordbooks/99999', {
      name: 'Ghost',
    });
    expect(res.status()).toBe(404);
  });

  test('名称为空返回 400', async ({ request }) => {
    const token = await getAuthToken(request);
    await importFrenchWords(request, token);

    const listRes = await authFetch(request, token, 'GET', '/api/vocab/wordbooks');
    const { wordbooks: wbs } = await listRes.json();

    const res = await authFetch(request, token, 'PUT', `/api/vocab/wordbooks/${wbs[0].id}`, {
      name: '',
    });
    expect(res.status()).toBe(400);
  });
});

test.describe('Wordbooks API - POST /api/vocab/wordbooks/[id]/activate', () => {
  test('切换活跃词汇本', async ({ request }) => {
    const token = await getAuthToken(request);
    await enableMultiWordbook(request);

    // Import creates new wordbooks in multi-mode (the default French wordbook from migration stays)
    await importFrenchWords(request, token, 'French Words');
    await importEnglishWords(request, token, 'English Words');

    // Get wordbooks list (default + French + English = 3)
    const listRes = await authFetch(request, token, 'GET', '/api/vocab/wordbooks');
    const { wordbooks: wbs } = await listRes.json();
    // In multi-mode, each import creates a new wordbook
    expect(wbs.length).toBeGreaterThanOrEqual(2);

    // The English wordbook (last imported) should be active
    const englishWb = wbs.find((wb: any) => wb.language === 'en');
    const frenchWb = wbs.find((wb: any) => wb.language === 'fr' && !wb.isActive);
    expect(englishWb).toBeDefined();
    expect(frenchWb).toBeDefined();
    expect(englishWb.isActive).toBe(true);

    // Activate French wordbook
    const res = await authFetch(request, token, 'POST', `/api/vocab/wordbooks/${frenchWb.id}/activate`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.isActive).toBe(true);

    // Verify via GET
    const verifyRes = await authFetch(request, token, 'GET', '/api/vocab/wordbooks');
    const verified = await verifyRes.json();
    expect(verified.activeWordbookId).toBe(frenchWb.id);
  });

  test('不存在的词汇本返回 404', async ({ request }) => {
    const token = await getAuthToken(request);
    const res = await authFetch(request, token, 'POST', '/api/vocab/wordbooks/99999/activate');
    expect(res.status()).toBe(404);
  });
});

test.describe('Wordbooks API - DELETE /api/vocab/wordbooks/[id]', () => {
  test('删除非活跃词汇本', async ({ request }) => {
    const token = await getAuthToken(request);
    await enableMultiWordbook(request);

    // Import English words (creates a new English wordbook, becomes active)
    await importEnglishWords(request, token, 'English Words');

    const listRes = await authFetch(request, token, 'GET', '/api/vocab/wordbooks');
    const { wordbooks: wbs } = await listRes.json();

    // The default French wordbook from migration is not active now
    const frenchWb = wbs.find((wb: any) => wb.language === 'fr' && !wb.isActive);
    expect(frenchWb).toBeDefined();

    const countBefore = wbs.length;

    // Delete the inactive French wordbook
    const res = await authFetch(request, token, 'DELETE', `/api/vocab/wordbooks/${frenchWb.id}`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);

    // Verify it's gone
    const verifyRes = await authFetch(request, token, 'GET', '/api/vocab/wordbooks');
    const verified = await verifyRes.json();
    expect(verified.wordbooks).toHaveLength(countBefore - 1);
    // Only English wordbook remains
    expect(verified.wordbooks.every((wb: any) => wb.language === 'en')).toBe(true);
  });

  test('删除活跃词汇本返回 400', async ({ request }) => {
    const token = await getAuthToken(request);
    await enableMultiWordbook(request);

    // Import to create a second wordbook (the active one)
    await importEnglishWords(request, token, 'English Words');

    const listRes = await authFetch(request, token, 'GET', '/api/vocab/wordbooks');
    const { wordbooks: wbs } = await listRes.json();

    const activeWb = wbs.find((wb: any) => wb.isActive);
    expect(activeWb).toBeDefined();
    const res = await authFetch(request, token, 'DELETE', `/api/vocab/wordbooks/${activeWb.id}`);
    expect(res.status()).toBe(400);
  });

  test('删除唯一词汇本返回 400', async ({ request }) => {
    const token = await getAuthToken(request);

    // Only the default migration-seeded wordbook exists
    const listRes = await authFetch(request, token, 'GET', '/api/vocab/wordbooks');
    const { wordbooks: wbs } = await listRes.json();
    expect(wbs).toHaveLength(1);

    const res = await authFetch(request, token, 'DELETE', `/api/vocab/wordbooks/${wbs[0].id}`);
    expect(res.status()).toBe(400);
  });
});

// ─── 2. Word Scoping: words belong to active wordbook ───

test.describe('Wordbooks API - Word Scoping', () => {
  test('GET /api/vocab/words 只返回活跃词汇本的词汇', async ({ request }) => {
    const token = await getAuthToken(request);
    await enableMultiWordbook(request);

    // Import French words (creates new French wordbook in multi-mode, sets it active)
    await importFrenchWords(request, token, 'French Words');

    // Import English words (creates new English wordbook, sets it active)
    await importEnglishWords(request, token, 'English Words');

    // Active wordbook is now English -- GET words should return English words
    const wordsRes = await authFetch(request, token, 'GET', '/api/vocab/words');
    expect(wordsRes.ok()).toBeTruthy();
    const wordsBody = await wordsRes.json();
    expect(wordsBody.total).toBe(3); // hello, thanks, yes

    const wordTexts = wordsBody.words.map((w: any) => w.word);
    expect(wordTexts).toContain('hello');
    expect(wordTexts).not.toContain('bonjour');

    // Switch to the French wordbook that has words (not the default empty one)
    const listRes = await authFetch(request, token, 'GET', '/api/vocab/wordbooks');
    const { wordbooks: wbs } = await listRes.json();
    const frenchWbWithWords = wbs.find((wb: any) => wb.language === 'fr' && wb.wordCount > 0);
    expect(frenchWbWithWords).toBeDefined();

    await authFetch(request, token, 'POST', `/api/vocab/wordbooks/${frenchWbWithWords.id}/activate`);

    // Now GET words should return French words
    const frWordsRes = await authFetch(request, token, 'GET', '/api/vocab/words');
    const frWordsBody = await frWordsRes.json();
    expect(frWordsBody.total).toBe(5); // bonjour, merci, oui, non, salut

    const frWordTexts = frWordsBody.words.map((w: any) => w.word);
    expect(frWordTexts).toContain('bonjour');
    expect(frWordTexts).not.toContain('hello');
  });
});

// ─── 3. UI Tests ───

test.describe('Wordbooks UI - WordbookSelector', () => {
  test('多词汇本启用时显示 WordbookSelector', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await enableMultiWordbook(request);

    // Import words so there's a wordbook with words to show the main content
    await importFrenchWords(request, token);

    await loginAndGoToVocab(page);

    // WordbookSelector should be visible (multiWordbookEnabled=true and wordbooks.length > 0)
    await expect(page.locator('.wordbookSelector')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.wordbookTab.active')).toBeVisible();
  });

  test('多词汇本未启用时不显示 WordbookSelector', async ({ page, request }) => {
    const token = await getAuthToken(request);

    // Import words in single mode (multi_wordbook_enabled=false)
    await importFrenchWords(request, token);

    await loginAndGoToVocab(page);

    // Wait for word list to appear (confirms page is loaded with words)
    await expect(page.locator('.vocabItem').first()).toBeVisible({ timeout: 10000 });

    // WordbookSelector should NOT be visible (multiWordbookEnabled=false)
    await expect(page.locator('.wordbookSelector')).not.toBeVisible();
  });

  test('导入弹窗在多词汇本模式下显示语言选择', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await enableMultiWordbook(request);

    // Don't import words -- the empty state toolbar shows "导入 CSV"
    await loginAndGoToVocab(page);

    // Empty state should show "词库为空" with import button
    await expect(page.getByText('词库为空')).toBeVisible({ timeout: 10000 });

    // Click import button (in toolbar or empty state)
    await page.getByRole('button', { name: '导入 CSV' }).first().click();
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });

    // In multi-wordbook mode, language selection should be available
    await expect(page.locator('[role="dialog"]').locator('.fieldSelect')).toBeVisible({ timeout: 5000 });
    // Also check the wordbook name field
    await expect(page.locator('[role="dialog"]').locator('.fieldInput')).toBeVisible();
  });
});
