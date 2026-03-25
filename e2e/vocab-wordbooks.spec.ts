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

    // First fill the default French wordbook so it's not empty
    await importFrenchWords(request, token);

    // Import English words (default French wb now has words, so this creates a new English wordbook)
    await importEnglishWords(request, token, 'English Words');

    const listRes = await authFetch(request, token, 'GET', '/api/vocab/wordbooks');
    const { wordbooks: wbs } = await listRes.json();

    // The French wordbook is not active now (English is active)
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

// ─── 4. API Tests: Settings ───

test.describe('Wordbooks API - Settings', () => {
  test('PUT /api/vocab/settings 切换 multi_wordbook_enabled', async ({ request }) => {
    const token = await getAuthToken(request);

    // Initially multi_wordbook_enabled is false (default)
    const getRes1 = await authFetch(request, token, 'GET', '/api/vocab/settings');
    expect(getRes1.ok()).toBeTruthy();
    const settings1 = await getRes1.json();
    // Either key is missing or value is empty/falsy
    expect(settings1.multi_wordbook_enabled || '').not.toBe('true');

    // Enable multi_wordbook_enabled via PUT
    const putRes = await authFetch(request, token, 'PUT', '/api/vocab/settings', {
      key: 'multi_wordbook_enabled',
      value: 'true',
    });
    expect(putRes.ok()).toBeTruthy();
    const putBody = await putRes.json();
    expect(putBody.ok).toBe(true);

    // Verify it persisted
    const getRes2 = await authFetch(request, token, 'GET', '/api/vocab/settings');
    const settings2 = await getRes2.json();
    expect(settings2.multi_wordbook_enabled).toBe('true');
  });

  test('PUT /api/vocab/settings 拒绝不支持的 key', async ({ request }) => {
    const token = await getAuthToken(request);
    const res = await authFetch(request, token, 'PUT', '/api/vocab/settings', {
      key: 'unsupported_key',
      value: 'whatever',
    });
    expect(res.status()).toBe(400);
  });

  test('PUT /api/vocab/settings 可以禁用 multi_wordbook_enabled', async ({ request }) => {
    const token = await getAuthToken(request);
    await enableMultiWordbook(request);

    // Disable via PUT
    const putRes = await authFetch(request, token, 'PUT', '/api/vocab/settings', {
      key: 'multi_wordbook_enabled',
      value: '',
    });
    expect(putRes.ok()).toBeTruthy();

    // Verify disabled
    const getRes = await authFetch(request, token, 'GET', '/api/vocab/settings');
    const settings = await getRes.json();
    expect(settings.multi_wordbook_enabled).toBe('');
  });
});

// ─── 5. API Tests: Stats scoping by active wordbook ───

test.describe('Wordbooks API - Stats Scoping', () => {
  test('GET /api/vocab/stats 只返回活跃词汇本的统计', async ({ request }) => {
    const token = await getAuthToken(request);
    await enableMultiWordbook(request);

    // Import French words (5 words) into a new wordbook
    await importFrenchWords(request, token, 'French Words');

    // Import English words (3 words) into another wordbook — this becomes active
    await importEnglishWords(request, token, 'English Words');

    // Stats should reflect the active (English) wordbook: 3 words
    const statsRes = await authFetch(request, token, 'GET', '/api/vocab/stats');
    expect(statsRes.ok()).toBeTruthy();
    const stats = await statsRes.json();
    expect(stats.total).toBe(3);

    // Switch to the French wordbook that has words
    const listRes = await authFetch(request, token, 'GET', '/api/vocab/wordbooks');
    const { wordbooks: wbs } = await listRes.json();
    const frenchWb = wbs.find((wb: any) => wb.language === 'fr' && wb.wordCount > 0);
    expect(frenchWb).toBeDefined();

    await authFetch(request, token, 'POST', `/api/vocab/wordbooks/${frenchWb.id}/activate`);

    // Stats should now reflect the French wordbook: 5 words
    const statsRes2 = await authFetch(request, token, 'GET', '/api/vocab/stats');
    const stats2 = await statsRes2.json();
    expect(stats2.total).toBe(5);
  });
});

// ─── 6. API Tests: Import backward compatibility (single mode) ───

test.describe('Wordbooks API - Import Backward Compat', () => {
  test('单词汇本模式下导入替换现有词汇', async ({ request }) => {
    const token = await getAuthToken(request);

    // First import: 5 French words
    const res1 = await importFrenchWords(request, token);
    expect(res1.ok()).toBeTruthy();
    const body1 = await res1.json();
    expect(body1.imported).toBe(5);

    // Verify 5 words exist
    const wordsRes1 = await authFetch(request, token, 'GET', '/api/vocab/words');
    const words1 = await wordsRes1.json();
    expect(words1.total).toBe(5);

    // Second import: 3 English words (replaces, since multi is disabled)
    const res2 = await importEnglishWords(request, token);
    expect(res2.ok()).toBeTruthy();
    const body2 = await res2.json();
    expect(body2.imported).toBe(3);

    // Verify old words replaced — only 3 words now
    const wordsRes2 = await authFetch(request, token, 'GET', '/api/vocab/words');
    const words2 = await wordsRes2.json();
    expect(words2.total).toBe(3);

    // Still only 1 wordbook (the same default one, updated)
    const listRes = await authFetch(request, token, 'GET', '/api/vocab/wordbooks');
    const { wordbooks: wbs } = await listRes.json();
    expect(wbs).toHaveLength(1);
    expect(wbs[0].language).toBe('en'); // language updated to English
    expect(wbs[0].wordCount).toBe(3);
  });
});

// ─── 6b. API Tests: Import into empty active wordbook (multi mode) ───

test.describe('Wordbooks API - Import Into Empty Wordbook', () => {
  test('多词汇本模式下导入到空的活跃词汇本', async ({ request }) => {
    const token = await getAuthToken(request);
    await enableMultiWordbook(request);

    // Default French wordbook has 0 words — import should fill it, not create new
    const res = await importFrenchWords(request, token);
    expect(res.ok()).toBeTruthy();

    const listRes = await authFetch(request, token, 'GET', '/api/vocab/wordbooks');
    const { wordbooks: wbs } = await listRes.json();

    // Still only 1 wordbook (the default one, now filled)
    expect(wbs).toHaveLength(1);
    expect(wbs[0].wordCount).toBe(5);
    expect(wbs[0].language).toBe('fr');
    expect(wbs[0].isActive).toBe(true);
  });

  test('多词汇本模式下导入到非空词汇本时创建新词汇本', async ({ request }) => {
    const token = await getAuthToken(request);
    await enableMultiWordbook(request);

    // First import fills the default empty wordbook
    await importFrenchWords(request, token);

    // Second import should create a new wordbook (active wb now has words)
    const res = await importEnglishWords(request, token, 'English Words');
    expect(res.ok()).toBeTruthy();

    const listRes = await authFetch(request, token, 'GET', '/api/vocab/wordbooks');
    const { wordbooks: wbs } = await listRes.json();

    // Now 2 wordbooks
    expect(wbs).toHaveLength(2);
    const englishWb = wbs.find((wb: any) => wb.language === 'en');
    expect(englishWb).toBeDefined();
    expect(englishWb.name).toBe('English Words');
    expect(englishWb.wordCount).toBe(3);
    expect(englishWb.isActive).toBe(true);
  });

  test('导入到空词汇本时可更新语言和名称', async ({ request }) => {
    const token = await getAuthToken(request);
    await enableMultiWordbook(request);

    // Default is French with 0 words — import English into it with a custom name
    const res = await importEnglishWords(request, token, 'My English Book');
    expect(res.ok()).toBeTruthy();

    const listRes = await authFetch(request, token, 'GET', '/api/vocab/wordbooks');
    const { wordbooks: wbs } = await listRes.json();

    expect(wbs).toHaveLength(1);
    expect(wbs[0].language).toBe('en'); // language updated from fr to en
    expect(wbs[0].name).toBe('My English Book'); // name updated
    expect(wbs[0].wordCount).toBe(3);
  });
});

// ─── 7. UI Tests: Wordbook Switching ───

test.describe('Wordbooks UI - Wordbook Switching', () => {
  test('切换词汇本后显示对应语言的词汇', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await enableMultiWordbook(request);

    // Import French words (5 words)
    await importFrenchWords(request, token, 'French Words');
    // Import English words (3 words) — becomes active
    await importEnglishWords(request, token, 'English Words');

    await loginAndGoToVocab(page);

    // WordbookSelector should be visible
    await expect(page.locator('.wordbookSelector')).toBeVisible({ timeout: 10000 });

    // Should see both wordbook tabs (plus the default empty French one and the "+" button)
    const tabs = page.locator('.wordbookTab:not(.addBtn)');
    const tabCount = await tabs.count();
    expect(tabCount).toBeGreaterThanOrEqual(2);

    // Active tab should be English Words (last imported)
    const activeTab = page.locator('.wordbookTab.active');
    await expect(activeTab).toContainText('English Words');

    // Word list should show English words
    await expect(page.locator('.vocabItem').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.vocabItem').first()).toContainText(/hello|thanks|yes/);

    // Click on French Words tab to switch
    await page.locator('.wordbookTab').filter({ hasText: 'French Words' }).click();

    // Wait for the tab to become active
    await expect(page.locator('.wordbookTab.active')).toContainText('French Words', { timeout: 10000 });

    // Word list should now show French words
    await expect(page.locator('.vocabItem').first()).toContainText(/bonjour|merci|oui|non|salut/, { timeout: 10000 });
  });
});

// ─── 8. UI Tests: Import default behavior (multi disabled) ───

test.describe('Wordbooks UI - Import Single Mode', () => {
  test('单词汇本模式下导入弹窗不显示语言和名称字段', async ({ page, request }) => {
    // Multi-wordbook is disabled by default — don't call enableMultiWordbook

    await loginAndGoToVocab(page);

    // Empty state should show "词库为空" with import button
    await expect(page.getByText('词库为空')).toBeVisible({ timeout: 10000 });

    // Click import button
    await page.getByRole('button', { name: '导入 CSV' }).first().click();
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });

    // In single-wordbook mode, language/name fields should NOT be visible
    await expect(page.locator('[role="dialog"]').locator('.fieldSelect')).not.toBeVisible();
    await expect(page.locator('[role="dialog"]').locator('.fieldInput')).not.toBeVisible();
  });
});

// ─── 9. UI Tests: Create wordbook via UI ───

test.describe('Wordbooks UI - Create Wordbook', () => {
  test('通过 UI "+" 按钮打开导入弹窗', async ({ page, request }) => {
    const token = await getAuthToken(request);
    await enableMultiWordbook(request);

    // Import some words so the WordbookSelector shows
    await importFrenchWords(request, token, 'French Words');

    await loginAndGoToVocab(page);

    // WordbookSelector should be visible
    await expect(page.locator('.wordbookSelector')).toBeVisible({ timeout: 10000 });

    // Click "+" button — should open ImportModal
    await page.locator('.wordbookTab.addBtn').click();

    // ImportModal should be visible (it uses BaseModal with title "导入词汇 (CSV)")
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('导入词汇 (CSV)')).toBeVisible();
  });
});

// ─── 10. Admin API Tests: Per-user vocab settings ───

test.describe('Admin API - Per-user vocab settings', () => {
  test('PUT /api/admin/users/[id]/vocab-settings sets value and GET reads it back', async ({ request }) => {
    const token = await getAuthToken(request);

    // Get user list to find testuser's ID
    const usersRes = await authFetch(request, token, 'GET', '/api/admin/users');
    expect(usersRes.ok()).toBeTruthy();
    const userList = await usersRes.json();
    const testUser = userList.find((u: any) => u.username === TEST_USER.username);
    expect(testUser).toBeDefined();

    // Initially multiWordbookEnabled should be false
    const getRes1 = await authFetch(request, token, 'GET', `/api/admin/users/${testUser.id}/vocab-settings`);
    expect(getRes1.ok()).toBeTruthy();
    const settings1 = await getRes1.json();
    expect(settings1.multiWordbookEnabled).toBe(false);

    // Enable via PUT
    const putRes = await authFetch(request, token, 'PUT', `/api/admin/users/${testUser.id}/vocab-settings`, {
      key: 'multi_wordbook_enabled',
      value: 'true',
    });
    expect(putRes.ok()).toBeTruthy();
    const putBody = await putRes.json();
    expect(putBody.ok).toBe(true);

    // Read back via GET
    const getRes2 = await authFetch(request, token, 'GET', `/api/admin/users/${testUser.id}/vocab-settings`);
    const settings2 = await getRes2.json();
    expect(settings2.multiWordbookEnabled).toBe(true);

    // Disable via PUT
    const putRes2 = await authFetch(request, token, 'PUT', `/api/admin/users/${testUser.id}/vocab-settings`, {
      key: 'multi_wordbook_enabled',
      value: 'false',
    });
    expect(putRes2.ok()).toBeTruthy();

    // Read back — should be false
    const getRes3 = await authFetch(request, token, 'GET', `/api/admin/users/${testUser.id}/vocab-settings`);
    const settings3 = await getRes3.json();
    expect(settings3.multiWordbookEnabled).toBe(false);
  });

  test('PUT /api/admin/users/[id]/vocab-settings rejects unsupported key', async ({ request }) => {
    const token = await getAuthToken(request);

    const usersRes = await authFetch(request, token, 'GET', '/api/admin/users');
    const userList = await usersRes.json();
    const testUser = userList.find((u: any) => u.username === TEST_USER.username);

    const res = await authFetch(request, token, 'PUT', `/api/admin/users/${testUser.id}/vocab-settings`, {
      key: 'unsupported_key',
      value: 'whatever',
    });
    expect(res.status()).toBe(400);
  });

  test('GET /api/admin/users includes multiWordbookEnabled field', async ({ request }) => {
    const token = await getAuthToken(request);

    // Enable multi-wordbook for testuser via test endpoint
    await enableMultiWordbook(request);

    // Fetch users list
    const usersRes = await authFetch(request, token, 'GET', '/api/admin/users');
    expect(usersRes.ok()).toBeTruthy();
    const userList = await usersRes.json();
    const testUser = userList.find((u: any) => u.username === TEST_USER.username);
    expect(testUser).toBeDefined();
    expect(testUser.multiWordbookEnabled).toBe(true);
  });

  test('PUT /api/admin/users/[id]/vocab-settings returns 404 for non-existent user', async ({ request }) => {
    const token = await getAuthToken(request);

    const res = await authFetch(request, token, 'PUT', '/api/admin/users/99999/vocab-settings', {
      key: 'multi_wordbook_enabled',
      value: 'true',
    });
    expect(res.status()).toBe(404);
  });
});

// ─── 11. Study Session Wordbook Isolation ───

test.describe('Wordbooks API - Study Session Isolation', () => {
  test('SRS overview todaySession 按词汇本隔离', async ({ request }) => {
    const token = await getAuthToken(request);
    await enableMultiWordbook(request);

    // Import French words into the default empty wordbook
    await importFrenchWords(request, token);

    // Mark a word as learning so SRS can pick it up
    const wordsRes = await authFetch(request, token, 'GET', '/api/vocab/words');
    const { words } = await wordsRes.json();
    const wordId = words[0].id;
    await authFetch(request, token, 'POST', '/api/vocab/progress/status', {
      wordId, status: 'learning',
    });

    // Start SRS: get daily plan (this creates new word cards)
    const planRes = await authFetch(request, token, 'GET', '/api/vocab/srs/daily-plan');
    expect(planRes.ok()).toBeTruthy();
    const plan = await planRes.json();

    // Rate a card if available
    if (plan.newWords.length > 0) {
      // The daily-plan returns new words; to actually study, we need to rate them
      // Rate the first new word
      await authFetch(request, token, 'POST', '/api/vocab/srs/rate', {
        wordId: plan.newWords[0].wordId,
        quality: 4,
        isNew: true,
      });
    }

    // Check overview — should have todaySession for this wordbook
    const overviewRes = await authFetch(request, token, 'GET', '/api/vocab/srs/overview');
    const overview = await overviewRes.json();

    // Now import English words (creates new wordbook, becomes active)
    await importEnglishWords(request, token, 'English Words');

    // Check overview for the English wordbook — todaySession should be null (no study yet)
    const enOverviewRes = await authFetch(request, token, 'GET', '/api/vocab/srs/overview');
    const enOverview = await enOverviewRes.json();
    expect(enOverview.todaySession).toBeNull();
  });

  test('daily-plan newWords quota 按词汇本独立', async ({ request }) => {
    const token = await getAuthToken(request);
    await enableMultiWordbook(request);

    // Import French words
    await importFrenchWords(request, token);

    // Get daily plan for French wordbook
    const frPlanRes = await authFetch(request, token, 'GET', '/api/vocab/srs/daily-plan');
    const frPlan = await frPlanRes.json();
    const frRemainingBefore = frPlan.stats.remainingNewWords;

    // Import English words (creates new wordbook)
    await importEnglishWords(request, token, 'English Words');

    // Mark some English words as learning
    const enWordsRes = await authFetch(request, token, 'GET', '/api/vocab/words');
    const { words: enWords } = await enWordsRes.json();
    for (const w of enWords.slice(0, 2)) {
      await authFetch(request, token, 'POST', '/api/vocab/progress/status', {
        wordId: w.id, status: 'learning',
      });
    }

    // Get daily plan for English wordbook — should have full quota (independent of French)
    const enPlanRes = await authFetch(request, token, 'GET', '/api/vocab/srs/daily-plan');
    const enPlan = await enPlanRes.json();
    expect(enPlan.stats.remainingNewWords).toBeGreaterThan(0);
  });
});
