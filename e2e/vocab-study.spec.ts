import { test, expect, type Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
        body.includes('工具箱') ||
        body.includes('词汇学习') ||
        body.includes('日历打卡')
      );
    },
    { timeout: 10000 },
  );
}

async function navigateToVocab(page: Page) {
  await page.goto('/vocab-tracker');
  await waitForAppReady(page);
  await expect(page.getByRole('button', { name: '用户管理' })).toBeVisible({ timeout: 10000 });
}

async function createUser(page: Page, nickname: string) {
  const emptyCreateBtn = page.getByRole('button', { name: '创建用户' });
  const toolbarManageBtn = page.getByRole('button', { name: '用户管理' });

  if (await emptyCreateBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await emptyCreateBtn.click();
  } else {
    await toolbarManageBtn.click();
  }

  await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });
  await page.getByPlaceholder('新用户昵称').fill(nickname);
  await page.locator('[role="dialog"]').getByRole('button', { name: '创建', exact: true }).click();
  await page.waitForTimeout(500);

  const closeBtn = page.locator('[role="dialog"]').getByLabel('关闭');
  if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await closeBtn.click();
    await page.waitForTimeout(300);
  }
}

async function importCSV(page: Page) {
  await page.locator('.toolbar').getByRole('button', { name: '导入 CSV' }).click();
  await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });

  const csvPath = path.resolve(__dirname, 'fixtures/test-vocab.csv');
  const fileInput = page.locator('[role="dialog"] input[type="file"]');
  await fileInput.setInputFiles(csvPath);

  await expect(page.getByText('已解析')).toBeVisible({ timeout: 5000 });
  await expect(page.getByText('bonjour')).toBeVisible();

  await page.getByRole('button', { name: '确认导入' }).click();
  await expect(page.getByText('导入成功')).toBeVisible({ timeout: 10000 });

  await page.locator('.modal-footer').getByRole('button', { name: '关闭' }).click();
  await page.waitForTimeout(500);
}

async function setupUserAndWords(page: Page) {
  await navigateToVocab(page);
  await createUser(page, '测试用户');
  await expect(page.getByText('词库为空')).toBeVisible({ timeout: 5000 });
  await importCSV(page);
  await expect(page.getByText('bonjour')).toBeVisible({ timeout: 10000 });
}

/**
 * 将前 N 个词汇标记为"正在学习"状态
 * SRS 学习需要 LEARNING 状态的单词作为新词来源
 */
async function markWordsAsLearning(page: Page, count: number) {
  for (let i = 0; i < count; i++) {
    await page.locator('.vocabItem').nth(i).getByRole('button', { name: '开始学习' }).click();
    await page.waitForTimeout(300);
  }
}

/**
 * 切换到学习模式 tab
 */
async function navigateToStudy(page: Page) {
  await page.locator('.mainTab').filter({ hasText: '学习模式' }).click();
  await page.waitForTimeout(500);
}

/**
 * 切换回词汇列表 tab
 */
async function navigateToVocabList(page: Page) {
  await page.locator('.mainTab').filter({ hasText: '词汇列表' }).click();
  await page.waitForTimeout(500);
}

/**
 * Mock 定义端点 - 拦截浏览器到服务端的释义请求
 * 必须在页面导航之前调用
 */
async function mockDefinitionEndpoint(page: Page) {
  await page.route('**/api/vocab/definitions/*', async (route) => {
    const url = route.request().url();

    // 跳过 regenerate 子路由
    if (url.includes('/regenerate')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeMockDefinition()),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(makeMockDefinition()),
    });
  });
}

/**
 * Mock LLM chat 端点
 */
async function mockChatEndpoint(page: Page) {
  await page.route('**/api/llm/chat', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: '「bonjour」是法语中最常用的问候语，意为"你好"。它可以在正式和非正式场合使用。',
        meta: {
          provider: 'claude',
          modelName: 'haiku',
          timestamp: new Date().toISOString(),
        },
      }),
    });
  });
}

/**
 * Mock 所有 LLM 相关端点
 */
async function mockLLMEndpoints(page: Page) {
  await mockDefinitionEndpoint(page);
  await mockChatEndpoint(page);
}

function makeMockDefinition() {
  return {
    id: 1,
    wordId: 1,
    definition: '你好（问候语）',
    partOfSpeech: 'nom / interjection',
    example: 'Bonjour, comment allez-vous ?',
    exampleTranslation: '你好，你好吗？',
    examples: [
      { sentence: 'Bonjour, comment allez-vous ?', translation: '你好，你好吗？' },
      { sentence: 'Bonjour tout le monde !', translation: '大家好！' },
    ],
    synonyms: 'salut, coucou',
    antonyms: 'au revoir, adieu',
    wordFamily: 'bonjourner (v.)',
    collocations: 'dire bonjour, bonjour à tous',
    modelProvider: 'claude',
    modelName: 'haiku',
    fetchedAt: Date.now(),
    cached: true,
  };
}

// ─── 1. SRS 学习流程 ───

test.describe('SRS 学习流程', () => {
  test('概览界面显示统计卡片', async ({ page }) => {
    await mockLLMEndpoints(page);
    await setupUserAndWords(page);
    await markWordsAsLearning(page, 5);
    await navigateToStudy(page);

    // 概览界面应显示 4 个统计卡片
    await expect(page.getByText('SRS 卡片')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('待复习')).toBeVisible();
    await expect(page.getByText('学习中')).toBeVisible();
    await expect(page.getByText('已掌握')).toBeVisible();
  });

  test('开始学习 → 显示 FlashCard', async ({ page }) => {
    await mockLLMEndpoints(page);
    await setupUserAndWords(page);
    await markWordsAsLearning(page, 5);
    await navigateToStudy(page);

    // 点击"开始学习"
    await page.getByRole('button', { name: '开始学习' }).click();
    await page.waitForTimeout(1000);

    // 应显示 FlashCard 正面（法语单词 + 翻转提示）
    await expect(page.locator('.flipHint')).toBeVisible({ timeout: 10000 });
  });

  test('翻转 → 评分 → 下一张 → 完成', async ({ page }) => {
    await mockLLMEndpoints(page);
    await setupUserAndWords(page);
    await markWordsAsLearning(page, 3);
    await navigateToStudy(page);

    await page.getByRole('button', { name: '开始学习' }).click();
    await page.waitForTimeout(1000);

    // 遍历所有卡片
    for (let i = 0; i < 3; i++) {
      // 正面显示翻转提示
      await expect(page.locator('.flipHint')).toBeVisible({ timeout: 10000 });

      // 点击卡片翻转
      await page.locator('.cardWrapper').click();
      await page.waitForTimeout(600);

      // 翻转后显示评分区域
      await expect(page.getByText('你记住了吗？')).toBeVisible({ timeout: 5000 });

      // 点击"记得"评分
      await page.locator('.rateGood').click();
      await page.waitForTimeout(500);
    }

    // 完成后显示完成界面
    await expect(page.getByText('今日学习完成！')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('干得漂亮，继续保持！')).toBeVisible();
  });

  test('完成界面显示统计并可返回概览', async ({ page }) => {
    await mockLLMEndpoints(page);
    await setupUserAndWords(page);
    await markWordsAsLearning(page, 2);
    await navigateToStudy(page);

    await page.getByRole('button', { name: '开始学习' }).click();
    await page.waitForTimeout(1000);

    // 快速完成 2 张卡片
    for (let i = 0; i < 2; i++) {
      await expect(page.locator('.flipHint')).toBeVisible({ timeout: 10000 });
      await page.locator('.cardWrapper').click();
      await page.waitForTimeout(600);
      await page.locator('.rateEasy').click();
      await page.waitForTimeout(500);
    }

    // 完成界面统计
    await expect(page.getByText('今日学习完成！')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('新词学习')).toBeVisible();
    await expect(page.getByText('复习完成')).toBeVisible();

    // 返回概览
    await page.getByRole('button', { name: '返回概览' }).click();
    await page.waitForTimeout(500);

    // 应回到概览界面
    await expect(page.getByText('开始今日学习')).toBeVisible();
  });

  test('无可学习单词时点击开始 → 回到概览', async ({ page }) => {
    await mockLLMEndpoints(page);
    await setupUserAndWords(page);
    // 不标记任何词为"学习"状态
    await navigateToStudy(page);

    // 概览界面显示"开始今日学习"
    await expect(page.getByText('开始今日学习')).toBeVisible({ timeout: 5000 });

    // 点击开始学习 → 无卡片 → 仍停留在概览界面
    await page.locator('.startBtn').click();
    await page.waitForTimeout(1000);

    // 概览界面仍然显示（因为 0 张卡片，store 不会进入学习状态）
    await expect(page.getByText('开始今日学习')).toBeVisible({ timeout: 5000 });
  });
});

// ─── 2. FlashCard 交互 ───

test.describe('FlashCard 交互', () => {
  test('正面显示单词、排名、标签', async ({ page }) => {
    await mockLLMEndpoints(page);
    await setupUserAndWords(page);
    await markWordsAsLearning(page, 3);
    await navigateToStudy(page);

    await page.getByRole('button', { name: '开始学习' }).click();
    await page.waitForTimeout(1000);

    // 翻转提示可见
    await expect(page.locator('.flipHint')).toBeVisible({ timeout: 10000 });

    // 排名显示 (#数字)
    await expect(page.locator('.cardRank')).toBeVisible();

    // 新词标签
    await expect(page.locator('.cardTag.tagNew')).toBeVisible();
  });

  test('翻转后显示释义、例句、同义词', async ({ page }) => {
    await mockLLMEndpoints(page);
    await setupUserAndWords(page);
    await markWordsAsLearning(page, 3);
    await navigateToStudy(page);

    await page.getByRole('button', { name: '开始学习' }).click();
    await page.waitForTimeout(1000);

    // 翻转卡片
    await page.locator('.cardWrapper').click();
    await page.waitForTimeout(600);

    // 应显示释义（来自 mock）
    await expect(page.getByText('你好（问候语）')).toBeVisible({ timeout: 5000 });

    // 词性
    await expect(page.getByText('nom / interjection')).toBeVisible();

    // 例句区域
    await expect(page.locator('.infoLabel').filter({ hasText: '例句' })).toBeVisible();

    // 同义词区域
    await expect(page.locator('.infoLabel').filter({ hasText: '同义词' })).toBeVisible();

    // 反义词区域
    await expect(page.locator('.infoLabel').filter({ hasText: '反义词' })).toBeVisible();
  });

  test('四个评分按钮功能正确', async ({ page }) => {
    await mockLLMEndpoints(page);
    await setupUserAndWords(page);
    await markWordsAsLearning(page, 5);
    await navigateToStudy(page);

    await page.getByRole('button', { name: '开始学习' }).click();
    await page.waitForTimeout(1000);

    // 翻转卡片
    await page.locator('.cardWrapper').click();
    await page.waitForTimeout(600);

    // 四个评分按钮应可见
    await expect(page.locator('.rateFail')).toBeVisible();
    await expect(page.locator('.rateHard')).toBeVisible();
    await expect(page.locator('.rateGood')).toBeVisible();
    await expect(page.locator('.rateEasy')).toBeVisible();

    // 按钮文字正确
    await expect(page.locator('.rateFail')).toContainText('忘了');
    await expect(page.locator('.rateHard')).toContainText('模糊');
    await expect(page.locator('.rateGood')).toContainText('记得');
    await expect(page.locator('.rateEasy')).toContainText('简单');

    // 点击"忘了" → 进入下一张
    await page.locator('.rateFail').click();
    await page.waitForTimeout(500);

    // 下一张卡片应显示
    await expect(page.locator('.flipHint')).toBeVisible({ timeout: 10000 });
  });

  test('"问问题"按钮打开聊天面板', async ({ page }) => {
    await mockLLMEndpoints(page);
    await setupUserAndWords(page);
    await markWordsAsLearning(page, 3);
    await navigateToStudy(page);

    await page.getByRole('button', { name: '开始学习' }).click();
    await page.waitForTimeout(1000);

    // 翻转卡片
    await page.locator('.cardWrapper').click();
    await page.waitForTimeout(600);

    // 点击"问问题"按钮
    await page.locator('.chatBtn').click();
    await page.waitForTimeout(300);

    // 聊天面板应打开
    await expect(page.getByPlaceholder('输入问题...')).toBeVisible();
    await expect(page.getByRole('button', { name: '发送' })).toBeVisible();
  });
});

// ─── 3. 学习统计 ───

test.describe('学习统计', () => {
  test('概览统计数据正确', async ({ page }) => {
    await mockLLMEndpoints(page);
    await setupUserAndWords(page);
    await markWordsAsLearning(page, 5);
    await navigateToStudy(page);

    // 概览统计卡片应可见
    const statCards = page.locator('.statCard');
    await expect(statCards).toHaveCount(4, { timeout: 5000 });
  });

  test('学习过程中进度显示更新', async ({ page }) => {
    await mockLLMEndpoints(page);
    await setupUserAndWords(page);
    await markWordsAsLearning(page, 3);
    await navigateToStudy(page);

    await page.getByRole('button', { name: '开始学习' }).click();
    await page.waitForTimeout(1000);

    // 初始进度显示 0/N
    await expect(page.locator('.progressText')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.progressText')).toContainText(/0\/\d+/);

    // 完成第一张卡片
    await page.locator('.cardWrapper').click();
    await page.waitForTimeout(600);
    await page.locator('.rateGood').click();
    await page.waitForTimeout(500);

    // 进度应更新为 1/N
    await expect(page.locator('.progressText')).toContainText(/1\/\d+/);
  });

  test('今日学习子 tab 和学习记录子 tab', async ({ page }) => {
    await mockLLMEndpoints(page);
    await setupUserAndWords(page);
    await markWordsAsLearning(page, 3);
    await navigateToStudy(page);

    // 应有"今日学习"和"学习记录"两个子 tab
    await expect(page.locator('.subTab').filter({ hasText: '今日学习' })).toBeVisible();
    await expect(page.locator('.subTab').filter({ hasText: '学习记录' })).toBeVisible();

    // 默认在"今日学习"
    await expect(page.locator('.subTab.active')).toContainText('今日学习');

    // 点击"学习记录"
    await page.locator('.subTab').filter({ hasText: '学习记录' }).click();
    await page.waitForTimeout(500);

    // 学习记录子 tab 应激活
    await expect(page.locator('.subTab.active')).toContainText('学习记录');
  });
});

// ─── 4. LLM 释义（Mocked） ───

test.describe('LLM 释义', () => {
  test('翻转卡片后加载并显示 LLM 释义', async ({ page }) => {
    await mockLLMEndpoints(page);
    await setupUserAndWords(page);
    await markWordsAsLearning(page, 3);
    await navigateToStudy(page);

    await page.getByRole('button', { name: '开始学习' }).click();
    await page.waitForTimeout(1000);

    // 翻转卡片
    await page.locator('.cardWrapper').click();
    await page.waitForTimeout(600);

    // 释义应来自 mock（包含中文翻译）
    await expect(page.getByText('你好（问候语）')).toBeVisible({ timeout: 10000 });

    // 词性显示
    await expect(page.getByText('nom / interjection')).toBeVisible();
  });

  test('释义数据渲染到卡片上', async ({ page }) => {
    await mockLLMEndpoints(page);
    await setupUserAndWords(page);
    await markWordsAsLearning(page, 3);
    await navigateToStudy(page);

    await page.getByRole('button', { name: '开始学习' }).click();
    await page.waitForTimeout(1000);

    // 翻转卡片（study store 会在 startSession 中 await 定义加载）
    await page.locator('.cardWrapper').click();
    await page.waitForTimeout(600);

    // mock 的释义数据应正确渲染
    await expect(page.getByText('你好（问候语）')).toBeVisible({ timeout: 5000 });

    // 例句文本
    await expect(page.getByText('Bonjour, comment allez-vous ?')).toBeVisible();
    await expect(page.getByText('你好，你好吗？')).toBeVisible();

    // 同义词内容
    await expect(page.getByText('salut, coucou')).toBeVisible();

    // 反义词内容
    await expect(page.getByText('au revoir, adieu')).toBeVisible();
  });
});

// ─── 5. LLM 聊天（Mocked） ───

test.describe('LLM 聊天', () => {
  test('打开聊天 → 显示空状态引导', async ({ page }) => {
    await mockLLMEndpoints(page);
    await setupUserAndWords(page);
    await markWordsAsLearning(page, 3);
    await navigateToStudy(page);

    await page.getByRole('button', { name: '开始学习' }).click();
    await page.waitForTimeout(1000);

    // 翻转卡片
    await page.locator('.cardWrapper').click();
    await page.waitForTimeout(600);

    // 打开聊天
    await page.locator('.chatBtn').click();
    await page.waitForTimeout(300);

    // 聊天面板空状态提示
    await expect(page.getByText(/有什么想问的/)).toBeVisible();
    await expect(page.getByText(/用法、搭配、语法/)).toBeVisible();
  });

  test('发送消息 → 收到回复', async ({ page }) => {
    await mockLLMEndpoints(page);
    await setupUserAndWords(page);
    await markWordsAsLearning(page, 3);
    await navigateToStudy(page);

    await page.getByRole('button', { name: '开始学习' }).click();
    await page.waitForTimeout(1000);

    await page.locator('.cardWrapper').click();
    await page.waitForTimeout(600);

    await page.locator('.chatBtn').click();
    await page.waitForTimeout(300);

    // 输入问题
    await page.getByPlaceholder('输入问题...').fill('这个词怎么用？');
    await page.getByRole('button', { name: '发送' }).click();

    // 用户消息应显示
    await expect(page.locator('.bubbleUser').filter({ hasText: '这个词怎么用？' })).toBeVisible();

    // 等待回复（来自 mock）
    await expect(page.getByText(/最常用的问候语/)).toBeVisible({ timeout: 10000 });
  });

  test('发送按钮在无输入时禁用', async ({ page }) => {
    await mockLLMEndpoints(page);
    await setupUserAndWords(page);
    await markWordsAsLearning(page, 3);
    await navigateToStudy(page);

    await page.getByRole('button', { name: '开始学习' }).click();
    await page.waitForTimeout(1000);

    await page.locator('.cardWrapper').click();
    await page.waitForTimeout(600);

    await page.locator('.chatBtn').click();
    await page.waitForTimeout(300);

    // 发送按钮应禁用
    await expect(page.locator('.sendBtn')).toBeDisabled();
  });

  test('关闭聊天面板', async ({ page }) => {
    await mockLLMEndpoints(page);
    await setupUserAndWords(page);
    await markWordsAsLearning(page, 3);
    await navigateToStudy(page);

    await page.getByRole('button', { name: '开始学习' }).click();
    await page.waitForTimeout(1000);

    await page.locator('.cardWrapper').click();
    await page.waitForTimeout(600);

    await page.locator('.chatBtn').click();
    await page.waitForTimeout(300);

    // 聊天面板可见
    await expect(page.getByPlaceholder('输入问题...')).toBeVisible();

    // 点击关闭按钮 (WordChat drawer 的 × 按钮)
    await page.locator('.drawer .closeBtn').click();
    await page.waitForTimeout(300);

    // 聊天面板应关闭
    await expect(page.getByPlaceholder('输入问题...')).not.toBeVisible();
  });
});

// ─── 6. TTS 发音 ───

test.describe('TTS 发音', () => {
  test('FlashCard 正面有发音按钮', async ({ page }) => {
    await mockLLMEndpoints(page);
    await setupUserAndWords(page);
    await markWordsAsLearning(page, 3);
    await navigateToStudy(page);

    await page.getByRole('button', { name: '开始学习' }).click();
    await page.waitForTimeout(1000);

    // 正面发音按钮（SpeakButton title="朗读发音"）
    await expect(page.getByTitle('朗读发音').first()).toBeVisible({ timeout: 10000 });
  });

  test('FlashCard 翻转后也有发音按钮', async ({ page }) => {
    await mockLLMEndpoints(page);
    await setupUserAndWords(page);
    await markWordsAsLearning(page, 3);
    await navigateToStudy(page);

    await page.getByRole('button', { name: '开始学习' }).click();
    await page.waitForTimeout(1000);

    // 翻转
    await page.locator('.cardWrapper').click();
    await page.waitForTimeout(600);

    // 背面也应有发音按钮（单词 + 例句可能各一个）
    const speakBtns = page.getByTitle('朗读发音');
    const count = await speakBtns.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('点击发音按钮不报错', async ({ page }) => {
    await mockLLMEndpoints(page);
    await setupUserAndWords(page);
    await markWordsAsLearning(page, 3);
    await navigateToStudy(page);

    await page.getByRole('button', { name: '开始学习' }).click();
    await page.waitForTimeout(1000);

    // 收集页面错误
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    // 点击发音按钮
    const speakBtn = page.getByTitle('朗读发音').first();
    await speakBtn.click();
    await page.waitForTimeout(1000);

    // 不应有 JS 错误（TTS 可能静默失败，但不应抛异常）
    const criticalErrors = errors.filter(
      (e) => !e.includes('speechSynthesis') && !e.includes('TTS'),
    );
    expect(criticalErrors).toHaveLength(0);
  });
});

// ─── 7. 词汇列表 ↔ 学习模式切换 ───

test.describe('词汇列表 ↔ 学习模式切换', () => {
  test('从词汇列表切换到学习模式', async ({ page }) => {
    await mockLLMEndpoints(page);
    await setupUserAndWords(page);
    await markWordsAsLearning(page, 5);

    // 当前在词汇列表
    await expect(page.getByText('bonjour')).toBeVisible();

    // 切换到学习模式
    await navigateToStudy(page);

    // 应显示学习概览
    await expect(page.getByText('开始今日学习')).toBeVisible();

    // 词汇列表不应可见
    await expect(page.locator('.vocabItem')).not.toBeVisible();
  });

  test('从学习模式返回词汇列表', async ({ page }) => {
    await mockLLMEndpoints(page);
    await setupUserAndWords(page);
    await markWordsAsLearning(page, 5);
    await navigateToStudy(page);

    // 在学习模式概览界面
    await expect(page.getByText('开始今日学习')).toBeVisible();

    // 切换回词汇列表
    await navigateToVocabList(page);

    // 词汇列表应恢复显示
    await expect(page.getByText('bonjour')).toBeVisible({ timeout: 5000 });
  });

  test('切换 tab 状态保持正确', async ({ page }) => {
    await mockLLMEndpoints(page);
    await setupUserAndWords(page);

    // 当前在词汇列表，确认 tab 激活状态
    await expect(page.locator('.mainTab.active')).toContainText('词汇列表');

    // 切换到学习模式
    await navigateToStudy(page);
    await expect(page.locator('.mainTab.active')).toContainText('学习模式');

    // 切换回词汇列表
    await navigateToVocabList(page);
    await expect(page.locator('.mainTab.active')).toContainText('词汇列表');
  });
});

// ─── 8. 学习记录（StudyHistory）───

test.describe('学习记录', () => {
  test('完成学习后学习记录中显示已学单词', async ({ page }) => {
    await mockLLMEndpoints(page);
    await setupUserAndWords(page);
    await markWordsAsLearning(page, 3);
    await navigateToStudy(page);

    // 完成一轮学习
    await page.getByRole('button', { name: '开始学习' }).click();
    await page.waitForTimeout(1000);

    for (let i = 0; i < 3; i++) {
      await expect(page.locator('.flipHint')).toBeVisible({ timeout: 10000 });
      await page.locator('.cardWrapper').click();
      await page.waitForTimeout(600);
      await page.locator('.rateGood').click();
      await page.waitForTimeout(500);
    }

    // 返回概览
    await page.getByRole('button', { name: '返回概览' }).click();
    await page.waitForTimeout(500);

    // 切换到学习记录 tab
    await page.locator('.subTab').filter({ hasText: '学习记录' }).click();
    await page.waitForTimeout(500);

    // 应显示已学习的单词列表（wordItem 元素）
    await expect(page.locator('.wordItem').first()).toBeVisible({ timeout: 5000 });
  });

  test('学习记录支持按 SRS 阶段筛选', async ({ page }) => {
    await mockLLMEndpoints(page);
    await setupUserAndWords(page);
    await markWordsAsLearning(page, 3);
    await navigateToStudy(page);

    // 完成学习
    await page.getByRole('button', { name: '开始学习' }).click();
    await page.waitForTimeout(1000);

    for (let i = 0; i < 3; i++) {
      await expect(page.locator('.flipHint')).toBeVisible({ timeout: 10000 });
      await page.locator('.cardWrapper').click();
      await page.waitForTimeout(600);
      await page.locator('.rateGood').click();
      await page.waitForTimeout(500);
    }

    await page.getByRole('button', { name: '返回概览' }).click();
    await page.waitForTimeout(500);

    await page.locator('.subTab').filter({ hasText: '学习记录' }).click();
    await page.waitForTimeout(500);

    // 筛选标签应存在
    await expect(page.locator('.filterTab').filter({ hasText: '全部' })).toBeVisible();
    await expect(page.locator('.filterTab').filter({ hasText: '初学' })).toBeVisible();
    await expect(page.locator('.filterTab').filter({ hasText: '巩固中' })).toBeVisible();
    await expect(page.locator('.filterTab').filter({ hasText: '已掌握' })).toBeVisible();
  });

  test('学习记录搜索功能', async ({ page }) => {
    await mockLLMEndpoints(page);
    await setupUserAndWords(page);
    await markWordsAsLearning(page, 5);
    await navigateToStudy(page);

    // 完成学习
    await page.getByRole('button', { name: '开始学习' }).click();
    await page.waitForTimeout(1000);

    for (let i = 0; i < 5; i++) {
      await expect(page.locator('.flipHint')).toBeVisible({ timeout: 10000 });
      await page.locator('.cardWrapper').click();
      await page.waitForTimeout(600);
      await page.locator('.rateGood').click();
      await page.waitForTimeout(500);
    }

    await page.getByRole('button', { name: '返回概览' }).click();
    await page.waitForTimeout(500);

    await page.locator('.subTab').filter({ hasText: '学习记录' }).click();
    await page.waitForTimeout(500);

    // 确认有单词列表
    await expect(page.locator('.wordItem').first()).toBeVisible({ timeout: 5000 });

    // 搜索框
    const searchInput = page.getByPlaceholder('搜索单词或释义...');
    await searchInput.fill('bonjour');
    await page.waitForTimeout(500);

    // 搜索结果应包含 bonjour
    await expect(page.locator('.wordName').filter({ hasText: 'bonjour' })).toBeVisible();
  });

  test('学习记录初始空状态', async ({ page }) => {
    await mockLLMEndpoints(page);
    await setupUserAndWords(page);
    await markWordsAsLearning(page, 3);
    await navigateToStudy(page);

    // 直接切换到学习记录 tab
    await page.locator('.subTab').filter({ hasText: '学习记录' }).click();
    await page.waitForTimeout(500);

    // 初始无记录时显示空状态提示
    await expect(page.getByText('暂无学习记录，请先开始背单词')).toBeVisible();
  });

  test('学习记录点击单词打开详情', async ({ page }) => {
    await mockLLMEndpoints(page);
    await setupUserAndWords(page);
    await markWordsAsLearning(page, 3);
    await navigateToStudy(page);

    // 完成学习
    await page.getByRole('button', { name: '开始学习' }).click();
    await page.waitForTimeout(1000);

    for (let i = 0; i < 3; i++) {
      await expect(page.locator('.flipHint')).toBeVisible({ timeout: 10000 });
      await page.locator('.cardWrapper').click();
      await page.waitForTimeout(600);
      await page.locator('.rateGood').click();
      await page.waitForTimeout(500);
    }

    await page.getByRole('button', { name: '返回概览' }).click();
    await page.waitForTimeout(500);

    await page.locator('.subTab').filter({ hasText: '学习记录' }).click();
    await page.waitForTimeout(500);

    // 点击第一个单词打开详情
    await page.locator('.wordItem').first().click();
    await page.waitForTimeout(500);

    // WordDetailModal 应打开（BaseModal with word text）
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });
  });
});
