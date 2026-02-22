import { eq, and } from 'drizzle-orm';
import { articles, articleTranslations } from '../database/schema';
import { resolveProvider } from './llm-provider';
import { stripHtmlTags } from './article-sanitizer';
import { LlmError } from '../lib/llm';
import type { ChatMessage } from '../lib/llm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

export type TranslationType = 'full' | 'summary';

/** 构建逐段翻译 prompt */
export function buildFullTranslatePrompt(plainText: string): ChatMessage[] {
  return [
    {
      role: 'system',
      content: `你是一个专业翻译助手。请将以下外文文章逐段翻译成中文。

要求：
1. 保持原文的段落结构，逐段对照翻译
2. 翻译要准确、通顺、自然
3. 专业术语保留原文并在括号中给出中文翻译
4. 不要添加任何额外的说明或注释，只输出翻译结果
5. 每段之间用空行分隔`,
    },
    {
      role: 'user',
      content: `请翻译以下文章：\n\n${plainText}`,
    },
  ];
}

/** 构建精简概括 prompt */
export function buildSummaryPrompt(plainText: string): ChatMessage[] {
  return [
    {
      role: 'system',
      content: `你是一个专业的文章分析助手。请对以下外文文章进行精简概括。

要求：
1. 先列出 3-5 个核心要点（用「•」开头的列表形式）
2. 然后写一段 200 字以内的总结
3. 全部使用中文
4. 格式：

## 核心要点
• 要点一
• 要点二
• ...

## 总结
总结内容...`,
    },
    {
      role: 'user',
      content: `请概括以下文章：\n\n${plainText}`,
    },
  ];
}

interface TranslateArticleOptions {
  providerId?: number;
  force?: boolean;
}

/**
 * 翻译文章（单个类型），先查缓存再调 LLM。
 * 返回翻译内容字符串。
 */
export async function translateArticle(
  db: BetterSQLite3Database<any>,
  articleId: number,
  type: TranslationType,
  options?: TranslateArticleOptions,
): Promise<{ content: string; cached: boolean }> {
  // 查缓存（force 模式跳过）
  if (!options?.force) {
    const cached = await db.select()
      .from(articleTranslations)
      .where(and(
        eq(articleTranslations.articleId, articleId),
        eq(articleTranslations.type, type),
      ))
      .limit(1);

    if (cached.length > 0) {
      return { content: cached[0].content, cached: true };
    }
  }

  // 获取文章正文
  const article = await db.select()
    .from(articles)
    .where(eq(articles.id, articleId))
    .limit(1);

  if (article.length === 0) {
    throw createError({ statusCode: 404, message: '文章不存在' });
  }

  // 转纯文本给 LLM
  const plainText = stripHtmlTags(article[0].content);

  // 截断过长文本（防止 token 超限）
  const maxChars = 30000;
  const truncated = plainText.length > maxChars
    ? plainText.slice(0, maxChars) + '\n\n[... 文章过长，已截断]'
    : plainText;

  // 构建 prompt
  const messages = type === 'full'
    ? buildFullTranslatePrompt(truncated)
    : buildSummaryPrompt(truncated);

  // 调 LLM
  const { provider, config: providerConfig } = await resolveProvider(db, options?.providerId);

  const content = await provider.chat(messages, {
    temperature: 0.3,
    maxTokens: type === 'full' ? 8000 : 2000,
    timeout: type === 'full' ? 120000 : 60000,
  });

  // 缓存到数据库（force 模式先删旧记录再插入）
  if (options?.force) {
    await db.delete(articleTranslations).where(and(
      eq(articleTranslations.articleId, articleId),
      eq(articleTranslations.type, type),
    ));
  }
  await db.insert(articleTranslations).values({
    articleId,
    type,
    content,
    providerId: providerConfig.id,
    createdAt: Date.now(),
  });

  return { content, cached: false };
}
