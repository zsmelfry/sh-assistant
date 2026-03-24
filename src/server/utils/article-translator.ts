import { eq, and } from 'drizzle-orm';
import { articles, articleTranslations } from '../database/schema';
import { resolveProvider } from './llm-provider';
import { stripHtmlTags } from './article-sanitizer';
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

/** Check translation cache. Returns cached content or null. */
export async function checkTranslationCache(
  db: BetterSQLite3Database<any>,
  articleId: number,
  type: TranslationType,
): Promise<string | null> {
  const cached = await db.select()
    .from(articleTranslations)
    .where(and(
      eq(articleTranslations.articleId, articleId),
      eq(articleTranslations.type, type),
    ))
    .limit(1);
  return cached.length > 0 ? cached[0].content : null;
}

/** Fetch article, build prompt, resolve provider — everything needed before calling LLM. */
export async function prepareTranslation(
  db: BetterSQLite3Database<any>,
  articleId: number,
  type: TranslationType,
  providerId?: number,
) {
  const article = await db.select()
    .from(articles)
    .where(eq(articles.id, articleId))
    .limit(1);

  if (article.length === 0) {
    throw createError({ statusCode: 404, message: '文章不存在' });
  }

  const plainText = stripHtmlTags(article[0].content);
  const maxChars = 30000;
  const truncated = plainText.length > maxChars
    ? plainText.slice(0, maxChars) + '\n\n[... 文章过长，已截断]'
    : plainText;

  const messages = type === 'full'
    ? buildFullTranslatePrompt(truncated)
    : buildSummaryPrompt(truncated);

  const { provider, config: providerConfig } = await resolveProvider(db, providerId);

  const chatOptions = {
    temperature: 0.3,
    maxTokens: type === 'full' ? 8000 : 2000,
    timeout: type === 'full' ? 120000 : 60000,
  };

  return { messages, provider, providerConfig, chatOptions };
}

/** Save translation result to cache (deletes old entry first when force=true). */
export async function saveTranslationCache(
  db: BetterSQLite3Database<any>,
  articleId: number,
  type: TranslationType,
  content: string,
  providerId: number,
  force?: boolean,
): Promise<void> {
  if (force) {
    await db.delete(articleTranslations).where(and(
      eq(articleTranslations.articleId, articleId),
      eq(articleTranslations.type, type),
    ));
  }
  await db.insert(articleTranslations).values({
    articleId,
    type,
    content,
    providerId,
    createdAt: Date.now(),
  });
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
  if (!options?.force) {
    const cached = await checkTranslationCache(db, articleId, type);
    if (cached) return { content: cached, cached: true };
  }

  const { messages, provider, providerConfig, chatOptions } = await prepareTranslation(db, articleId, type, options?.providerId);
  const content = await provider.chat(messages, chatOptions);
  await saveTranslationCache(db, articleId, type, content, providerConfig.id, options?.force);

  return { content, cached: false };
}
