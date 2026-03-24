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
  // 工具栏上的"用户管理"按钮始终存在
  await expect(page.getByRole('button', { name: '用户管理' })).toBeVisible({ timeout: 10000 });
}

async function createUser(page: Page, nickname: string) {
  // 如果是空状态（无用户），点击"创建用户"按钮打开模态框
  const emptyCreateBtn = page.getByRole('button', { name: '创建用户' });
  const toolbarManageBtn = page.getByRole('button', { name: '用户管理' });

  if (await emptyCreateBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await emptyCreateBtn.click();
  } else {
    await toolbarManageBtn.click();
  }

  // 等待模态框打开
  await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });

  // 填写昵称并创建
  await page.getByPlaceholder('新用户昵称').fill(nickname);
  // UserModal 里的创建按钮
  await page.locator('[role="dialog"]').getByRole('button', { name: '创建', exact: true }).click();
  await page.waitForTimeout(500);

  // 关闭模态框
  const closeBtn = page.locator('[role="dialog"]').getByLabel('关闭');
  if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await closeBtn.click();
    await page.waitForTimeout(300);
  }
}

async function importCSV(page: Page) {
  // 点击工具栏上的"导入 CSV"按钮（用 .toolbar 限定避免匹配空状态按钮）
  await page.locator('.toolbar').getByRole('button', { name: '导入 CSV' }).click();
  await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });

  // 上传 CSV 文件
  const csvPath = path.resolve(__dirname, 'fixtures/test-vocab.csv');
  const fileInput = page.locator('[role="dialog"] input[type="file"]');
  await fileInput.setInputFiles(csvPath);

  // 等待预览显示
  await expect(page.getByText('已解析')).toBeVisible({ timeout: 5000 });
  await expect(page.getByText('bonjour')).toBeVisible();

  // 点击"确认导入"
  await page.getByRole('button', { name: '确认导入' }).click();

  // 等待导入成功
  await expect(page.getByText('导入成功')).toBeVisible({ timeout: 10000 });

  // 关闭模态框（点击 footer 中的"关闭"按钮）
  await page.locator('.modal-footer').getByRole('button', { name: '关闭' }).click();
  await page.waitForTimeout(500);
}

async function setupUserAndWords(page: Page) {
  await navigateToVocab(page);
  await createUser(page, '测试用户');
  // 创建用户后显示"词库为空"引导
  await expect(page.getByText('词库为空')).toBeVisible({ timeout: 5000 });
  await importCSV(page);
  // 等待词汇列表显示
  await expect(page.getByText('bonjour')).toBeVisible({ timeout: 10000 });
}

// ─── 1. 侧边栏导航测试 ───

test.describe('侧边栏导航', () => {
  test('侧边栏显示词汇学习入口', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    const vocabLink = page.locator('.sidebar-nav').getByText('词汇学习');
    await expect(vocabLink).toBeVisible();
  });

  test('点击词汇学习进入对应页面', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    await page.locator('.sidebar-nav').getByText('词汇学习').click();
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/\/vocab-tracker/);
  });

  test('侧边栏高亮当前工具', async ({ page }) => {
    await page.goto('/vocab-tracker');
    await waitForAppReady(page);

    const activeItem = page.locator('.nav-item.active');
    await expect(activeItem).toContainText('词汇学习');
  });
});

// ─── 2. 用户管理测试 ───

test.describe('用户管理', () => {
  test('创建新用户', async ({ page }) => {
    await navigateToVocab(page);
    await createUser(page, '张三');

    // 工具栏显示用户名
    await expect(page.locator('.currentUserName')).toContainText('张三');
  });

  test('创建第二个用户并切换', async ({ page }) => {
    await navigateToVocab(page);
    await createUser(page, '张三');

    // 打开用户管理创建第二个用户
    await page.getByRole('button', { name: '用户管理' }).click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    await page.getByPlaceholder('新用户昵称').fill('李四');
    await page.locator('[role="dialog"]').getByRole('button', { name: '创建', exact: true }).click();
    await page.waitForTimeout(500);

    // 当前用户应自动切换到李四
    // 现在切换回张三
    const switchBtn = page.locator('.userItem').filter({ hasText: '张三' }).getByRole('button', { name: '切换' });
    await switchBtn.click();
    await page.waitForTimeout(500);

    // 关闭模态框
    await page.locator('[role="dialog"]').getByLabel('关闭').click();
    await page.waitForTimeout(300);

    // 验证当前用户是张三
    await expect(page.locator('.currentUserName')).toContainText('张三');
  });

  test('删除用户', async ({ page }) => {
    await navigateToVocab(page);
    await createUser(page, '用户A');

    // 创建第二个用户（删除需要至少2个用户）
    await page.getByRole('button', { name: '用户管理' }).click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    await page.getByPlaceholder('新用户昵称').fill('用户B');
    await page.locator('[role="dialog"]').getByRole('button', { name: '创建', exact: true }).click();
    await page.waitForTimeout(500);

    // 删除用户A
    const userAItem = page.locator('.userItem').filter({ hasText: '用户A' });
    await userAItem.getByRole('button', { name: '删除' }).click();
    await page.waitForTimeout(300);

    // 确认删除对话框
    await expect(page.getByText('确定要删除用户')).toBeVisible({ timeout: 3000 });
    await page.getByRole('button', { name: '删除' }).last().click();
    await page.waitForTimeout(500);

    // 用户A 应该不再显示
    await expect(page.locator('.userItem').filter({ hasText: '用户A' })).not.toBeVisible();
  });

  test('只有一个用户时删除按钮禁用', async ({ page }) => {
    await navigateToVocab(page);
    await createUser(page, '唯一用户');

    await page.getByRole('button', { name: '用户管理' }).click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    const deleteBtn = page.locator('.userItem').getByRole('button', { name: '删除' });
    await expect(deleteBtn).toBeDisabled();
  });
});

// ─── 3. CSV 导入测试 ───

test.describe('CSV 导入', () => {
  test('上传 CSV 后词汇正确入库', async ({ page }) => {
    await setupUserAndWords(page);

    // 验证词汇可见（第一页 20 条中的几个）
    await expect(page.getByText('bonjour')).toBeVisible();
    await expect(page.getByText('merci')).toBeVisible();

    // 验证显示排名
    await expect(page.locator('.rank').first()).toBeVisible();
  });

  test('导入预览显示正确数据', async ({ page }) => {
    await navigateToVocab(page);
    await createUser(page, '测试用户');
    await expect(page.getByText('词库为空')).toBeVisible({ timeout: 5000 });

    // 打开导入模态框并上传文件
    await page.locator('.toolbar').getByRole('button', { name: '导入 CSV' }).click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    const csvPath = path.resolve(__dirname, 'fixtures/test-vocab.csv');
    await page.locator('[role="dialog"] input[type="file"]').setInputFiles(csvPath);

    // 验证预览
    await expect(page.getByText('已解析')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('25')).toBeVisible(); // 25 行数据
    await expect(page.getByText('还有 15 条')).toBeVisible(); // 预览 10 条，还有 15 条

    // 取消不导入
    await page.getByRole('button', { name: '取消' }).click();
  });

  test('导入后统计面板显示正确总数', async ({ page }) => {
    await setupUserAndWords(page);

    // 总词数卡片显示 25
    const totalCard = page.locator('.statCard').filter({ hasText: '总词数' });
    await expect(totalCard.locator('.statValue')).toContainText('25');
  });
});

// ─── 4. 词汇列表测试 ───

test.describe('词汇列表', () => {
  test('显示词汇和学习状态', async ({ page }) => {
    await setupUserAndWords(page);

    const firstItem = page.locator('.vocabItem').first();
    await expect(firstItem.locator('.rank')).toBeVisible();
    await expect(firstItem.locator('.word')).toBeVisible();
    await expect(firstItem.locator('.status')).toBeVisible();
  });

  test('新导入词汇默认为未读状态', async ({ page }) => {
    await setupUserAndWords(page);

    const firstStatus = page.locator('.vocabItem').first().locator('.status');
    await expect(firstStatus).toContainText('未读');
  });

  test('每个词汇项有复选框', async ({ page }) => {
    await setupUserAndWords(page);

    const checkboxes = page.locator('.vocabItem .checkbox');
    await expect(checkboxes.first()).toBeVisible();
    expect(await checkboxes.count()).toBeGreaterThan(0);
  });
});

// ─── 5. 筛选功能测试 ───

test.describe('筛选功能', () => {
  test('显示5个筛选按钮', async ({ page }) => {
    await setupUserAndWords(page);

    const filterBtns = page.locator('.filterBtn');
    await expect(filterBtns).toHaveCount(5);
    await expect(filterBtns.nth(0)).toContainText('全部');
    await expect(filterBtns.nth(1)).toContainText('未读');
    await expect(filterBtns.nth(2)).toContainText('待学习');
    await expect(filterBtns.nth(3)).toContainText('正在学习');
    await expect(filterBtns.nth(4)).toContainText('已掌握');
  });

  test('默认选中"全部"筛选', async ({ page }) => {
    await setupUserAndWords(page);

    const allBtn = page.locator('.filterBtn').filter({ hasText: '全部' });
    await expect(allBtn).toHaveClass(/active/);
  });

  test('按状态筛选', async ({ page }) => {
    await setupUserAndWords(page);

    // 将 bonjour 标记为待学习
    const firstItem = page.locator('.vocabItem').first();
    await firstItem.getByRole('button', { name: '待学习' }).click();
    await page.waitForTimeout(500);

    // 点击"待学习"筛选
    await page.locator('.filterBtn').filter({ hasText: '待学习' }).click();
    await page.waitForTimeout(500);

    // 列表应只显示"待学习"状态词汇
    const items = page.locator('.vocabItem');
    const count = await items.count();
    expect(count).toBe(1);
    await expect(items.first().locator('.status')).toContainText('待学习');
  });

  test('搜索功能', async ({ page }) => {
    await setupUserAndWords(page);

    await page.getByPlaceholder('搜索词汇...').fill('bonjour');
    await page.waitForTimeout(500); // 300ms debounce + buffer

    const items = page.locator('.vocabItem');
    await expect(items).toHaveCount(1);
    await expect(items.first().locator('.word')).toContainText('bonjour');
  });

  test('清除搜索后恢复全部', async ({ page }) => {
    await setupUserAndWords(page);

    await page.getByPlaceholder('搜索词汇...').fill('bonjour');
    await page.waitForTimeout(500);

    // 清除搜索
    await page.locator('.clearBtn').click();
    await page.waitForTimeout(500);

    // 恢复第一页（20 条）
    const items = page.locator('.vocabItem');
    await expect(items).toHaveCount(20);
  });
});

// ─── 6. 分页功能测试 ───

test.describe('分页功能', () => {
  test('25 条数据分 2 页', async ({ page }) => {
    await setupUserAndWords(page);

    await expect(page.locator('.vocabItem')).toHaveCount(20);
    await expect(page.locator('.rangeText')).toContainText('第 1-20 条，共 25 条');
  });

  test('翻到第二页', async ({ page }) => {
    await setupUserAndWords(page);

    await page.locator('.pageBtn').filter({ hasText: '2' }).click();
    await page.waitForTimeout(500);

    await expect(page.locator('.vocabItem')).toHaveCount(5);
    await expect(page.locator('.rangeText')).toContainText('第 21-25 条，共 25 条');
  });

  test('跳转到指定页', async ({ page }) => {
    await setupUserAndWords(page);

    await page.locator('.jumpInput').fill('2');
    await page.locator('.jumpBtn').click();
    await page.waitForTimeout(500);

    await expect(page.locator('.rangeText')).toContainText('第 21-25 条，共 25 条');
  });

  test('第一页时上一页按钮禁用', async ({ page }) => {
    await setupUserAndWords(page);

    // 上一页按钮是 pageControls 中第一个 pageBtn（< 按钮）
    const prevBtn = page.locator('.pageControls > .pageBtn').first();
    await expect(prevBtn).toBeDisabled();
  });

  test('最后一页时下一页按钮禁用', async ({ page }) => {
    await setupUserAndWords(page);

    await page.locator('.pageBtn').filter({ hasText: '2' }).click();
    await page.waitForTimeout(500);

    // 下一页按钮是 page buttons 后面、jumpBox 之前的最后一个 > 按钮
    // pageControls 的直接子 pageBtn 中，最后一个是 > 按钮
    const pageBtns = page.locator('.pageControls > .pageBtn');
    const count = await pageBtns.count();
    const nextBtn = pageBtns.nth(count - 1);
    await expect(nextBtn).toBeDisabled();
  });
});

// ─── 7. 状态更新测试（状态机转换） ───

test.describe('状态更新', () => {
  test('未读 → 待学习', async ({ page }) => {
    await setupUserAndWords(page);

    const firstItem = page.locator('.vocabItem').first();
    await expect(firstItem.locator('.status')).toContainText('未读');

    await firstItem.getByRole('button', { name: '待学习' }).click();
    await page.waitForTimeout(500);

    await expect(firstItem.locator('.status')).toContainText('待学习');
  });

  test('未读 → 开始学习（正在学习）', async ({ page }) => {
    await setupUserAndWords(page);

    const firstItem = page.locator('.vocabItem').first();
    await firstItem.getByRole('button', { name: '开始学习' }).click();
    await page.waitForTimeout(500);

    await expect(firstItem.locator('.status')).toContainText('正在学习');
  });

  test('未读 → 已掌握', async ({ page }) => {
    await setupUserAndWords(page);

    const firstItem = page.locator('.vocabItem').first();
    await firstItem.getByRole('button', { name: '已掌握' }).click();
    await page.waitForTimeout(500);

    await expect(firstItem.locator('.status')).toContainText('已掌握');
  });

  test('待学习 → 开始学习', async ({ page }) => {
    await setupUserAndWords(page);

    const firstItem = page.locator('.vocabItem').first();
    await firstItem.getByRole('button', { name: '待学习' }).click();
    await page.waitForTimeout(500);
    await firstItem.getByRole('button', { name: '开始学习' }).click();
    await page.waitForTimeout(500);

    await expect(firstItem.locator('.status')).toContainText('正在学习');
  });

  test('正在学习 → 已掌握', async ({ page }) => {
    await setupUserAndWords(page);

    const firstItem = page.locator('.vocabItem').first();
    await firstItem.getByRole('button', { name: '开始学习' }).click();
    await page.waitForTimeout(500);
    await firstItem.getByRole('button', { name: '已掌握' }).click();
    await page.waitForTimeout(500);

    await expect(firstItem.locator('.status')).toContainText('已掌握');
  });

  test('已掌握 → 返回学习', async ({ page }) => {
    await setupUserAndWords(page);

    const firstItem = page.locator('.vocabItem').first();
    await firstItem.getByRole('button', { name: '已掌握' }).click();
    await page.waitForTimeout(500);
    await firstItem.getByRole('button', { name: '返回学习' }).click();
    await page.waitForTimeout(500);

    await expect(firstItem.locator('.status')).toContainText('正在学习');
  });

  test('按钮随状态变化：未读3个，已掌握1个', async ({ page }) => {
    await setupUserAndWords(page);

    const firstItem = page.locator('.vocabItem').first();

    // 未读：3 个按钮（待学习、开始学习、已掌握）
    await expect(firstItem.locator('.actionBtn')).toHaveCount(3);

    // 标记已掌握
    await firstItem.getByRole('button', { name: '已掌握' }).click();
    await page.waitForTimeout(500);

    // 已掌握：1 个按钮（返回学习）
    await expect(firstItem.locator('.actionBtn')).toHaveCount(1);
    await expect(firstItem.locator('.actionBtn').first()).toContainText('返回学习');
  });
});

// ─── 8. 批量操作测试 ───

test.describe('批量操作', () => {
  test('展开批量操作面板', async ({ page }) => {
    await setupUserAndWords(page);

    await page.getByRole('button', { name: /批量操作/ }).click();
    await page.waitForTimeout(300);

    await expect(page.locator('.batchPanel')).toBeVisible();
    await expect(page.getByText(/当前页全选/)).toBeVisible();
  });

  test('当前页全选', async ({ page }) => {
    await setupUserAndWords(page);

    await page.getByRole('button', { name: /批量操作/ }).click();
    await page.waitForTimeout(300);

    await page.locator('.selectAll input[type="checkbox"]').click();
    await page.waitForTimeout(300);

    const checkboxes = page.locator('.vocabItem .checkbox');
    const count = await checkboxes.count();
    for (let i = 0; i < count; i++) {
      await expect(checkboxes.nth(i)).toBeChecked();
    }
  });

  test('批量标记为已掌握', async ({ page }) => {
    await setupUserAndWords(page);

    // 选择前两个词汇
    await page.locator('.vocabItem').nth(0).locator('.checkbox').click();
    await page.locator('.vocabItem').nth(1).locator('.checkbox').click();
    await page.waitForTimeout(200);

    // 展开批量操作面板
    await page.getByRole('button', { name: /批量操作/ }).click();
    await page.waitForTimeout(300);

    // 批量标记已掌握
    await page.getByRole('button', { name: '标记已掌握' }).click();
    await page.waitForTimeout(1000);

    // 统计面板：已掌握 = 2
    const masteredCard = page.locator('.statCard').filter({ hasText: '已掌握' });
    await expect(masteredCard.locator('.statValue')).toContainText('2');
  });

  test('未选择时批量操作按钮禁用', async ({ page }) => {
    await setupUserAndWords(page);

    await page.getByRole('button', { name: /批量操作/ }).click();
    await page.waitForTimeout(300);

    const batchBtns = page.locator('.batchBtn');
    const count = await batchBtns.count();
    for (let i = 0; i < count; i++) {
      await expect(batchBtns.nth(i)).toBeDisabled();
    }
  });
});

// ─── 9. 统计面板测试 ───

test.describe('统计面板', () => {
  test('显示5个统计卡片', async ({ page }) => {
    await setupUserAndWords(page);

    await expect(page.locator('.statCard')).toHaveCount(5);
  });

  test('状态变化后统计实时更新', async ({ page }) => {
    await setupUserAndWords(page);

    // 初始：25 个全是未读
    const totalCard = page.locator('.statCard').filter({ hasText: '总词数' });
    await expect(totalCard.locator('.statValue')).toContainText('25');
    const unreadCard = page.locator('.statCard').filter({ hasText: '未读' });
    await expect(unreadCard.locator('.statValue')).toContainText('25');

    // 将第一个词标记为"正在学习"
    await page.locator('.vocabItem').first().getByRole('button', { name: '开始学习' }).click();
    await page.waitForTimeout(500);

    // 统计更新
    await expect(unreadCard.locator('.statValue')).toContainText('24');
    const learningCard = page.locator('.statCard').filter({ hasText: '正在学习' });
    await expect(learningCard.locator('.statValue')).toContainText('1');
  });

  test('点击统计卡片跳转到对应筛选', async ({ page }) => {
    await setupUserAndWords(page);

    // 先标记一个词为已掌握
    await page.locator('.vocabItem').first().getByRole('button', { name: '已掌握' }).click();
    await page.waitForTimeout(500);

    // 点击"已掌握"统计卡片
    await page.locator('.statCard').filter({ hasText: '已掌握' }).click();
    await page.waitForTimeout(500);

    // "已掌握"筛选按钮激活
    await expect(page.locator('.filterBtn').filter({ hasText: '已掌握' })).toHaveClass(/active/);

    // 列表只显示已掌握的词汇
    await expect(page.locator('.vocabItem')).toHaveCount(1);
  });

  test('百分比显示正确', async ({ page }) => {
    await setupUserAndWords(page);

    // 将 5 个词标记为已掌握（5/25 = 20%）
    for (let i = 0; i < 5; i++) {
      await page.locator('.vocabItem').nth(i).getByRole('button', { name: '已掌握' }).click();
      await page.waitForTimeout(300);
    }

    const masteredCard = page.locator('.statCard').filter({ hasText: '已掌握' });
    await expect(masteredCard.locator('.statPercent')).toContainText('20%');
  });
});

// ─── 10. 进度图表测试 ───

test.describe('进度图表', () => {
  test('初始无数据时显示"暂无数据"', async ({ page }) => {
    await setupUserAndWords(page);

    // 刚导入时未操作任何词，图表应显示暂无数据
    await expect(page.locator('.progressChart').getByText('暂无数据')).toBeVisible();
  });

  test('操作词汇后 SVG 图表渲染', async ({ page }) => {
    await setupUserAndWords(page);

    // 标记几个词以生成图表数据
    for (let i = 0; i < 3; i++) {
      await page.locator('.vocabItem').nth(i).getByRole('button', { name: '已掌握' }).click();
      await page.waitForTimeout(300);
    }

    // SVG 图表应出现
    const chart = page.locator('.progressChart svg');
    await expect(chart).toBeVisible({ timeout: 5000 });

    // 验证有折线和图例
    await expect(chart.locator('polyline').first()).toBeAttached();
    await expect(page.getByText('已掌握').last()).toBeVisible();
    await expect(page.getByText('已读').last()).toBeVisible();
  });
});

// ─── 11. 工具切换测试 ───

test.describe('工具切换', () => {
  test('habit-tracker ↔ vocab-tracker 切换互不干扰', async ({ page }) => {
    // 设置 vocab-tracker 数据
    await setupUserAndWords(page);

    // 标记第一个词为已掌握
    await page.locator('.vocabItem').first().getByRole('button', { name: '已掌握' }).click();
    await page.waitForTimeout(500);

    // 切换到 habit-tracker
    await page.locator('.sidebar-nav').getByText('日历打卡').click();
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/\/habit-tracker/);

    // habit-tracker 页面正常
    await page.waitForFunction(
      () => {
        const body = document.body.textContent || '';
        return body.includes('还没有习惯') || body.includes('习惯列表') || body.includes('连续打卡');
      },
      { timeout: 10000 },
    );

    // 切回 vocab-tracker
    await page.locator('.sidebar-nav').getByText('词汇学习').click();
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/\/vocab-tracker/);

    // vocab-tracker 数据不丢失
    await expect(page.getByText('bonjour')).toBeVisible({ timeout: 5000 });
    const masteredCard = page.locator('.statCard').filter({ hasText: '已掌握' });
    await expect(masteredCard.locator('.statValue')).toContainText('1');
  });

  test('habit-tracker 数据不受 vocab-tracker 影响', async ({ page }) => {
    // 在 habit-tracker 创建习惯
    await page.goto('/habit-tracker');
    await page.waitForFunction(
      () => {
        const body = document.body.textContent || '';
        return body.includes('还没有习惯') || body.includes('习惯列表');
      },
      { timeout: 10000 },
    );

    const emptyButton = page.getByRole('button', { name: '创建第一个习惯' });
    const newButton = page.getByRole('button', { name: '+ 新建' });
    await expect(emptyButton.or(newButton)).toBeVisible({ timeout: 10000 });

    if (await emptyButton.isVisible()) {
      await emptyButton.click();
    } else {
      await newButton.click();
    }
    await page.getByPlaceholder('输入习惯名称...').fill('跑步');
    await page.getByRole('button', { name: '创建', exact: true }).click();
    await expect(page.getByText('连续打卡天数')).toBeVisible({ timeout: 10000 });

    // 切到 vocab-tracker
    await page.locator('.sidebar-nav').getByText('词汇学习').click();
    await page.waitForTimeout(500);

    // 切回 habit-tracker
    await page.locator('.sidebar-nav').getByText('日历打卡').click();
    await page.waitForTimeout(500);

    // 习惯仍在
    await expect(page.getByText('跑步')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('连续打卡天数')).toBeVisible();
  });
});
