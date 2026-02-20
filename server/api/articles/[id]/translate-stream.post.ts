import { eq, and } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { articles, articleTranslations } from '~/server/database/schema';
import { resolveProvider } from '~/server/utils/llm-provider';
import { stripHtmlTags } from '~/server/utils/article-sanitizer';
import { LlmError } from '~/server/lib/llm';
import type { ChatMessage } from '~/server/lib/llm';

/** Build full-text translation prompt */
function buildFullTranslatePrompt(plainText: string): ChatMessage[] {
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

/** Build summary prompt */
function buildSummaryPrompt(plainText: string): ChatMessage[] {
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

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'));
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的文章 ID' });
  }

  const body = await readBody(event);
  const { type, providerId, force } = body;

  const validTypes = ['full', 'summary'];
  if (!type || !validTypes.includes(type)) {
    throw createError({
      statusCode: 400,
      message: `type 必须是 ${validTypes.join(', ')} 之一`,
    });
  }

  const db = useDB();

  // Check cache (skip in force mode)
  if (!force) {
    const cached = await db.select()
      .from(articleTranslations)
      .where(and(
        eq(articleTranslations.articleId, id),
        eq(articleTranslations.type, type),
      ))
      .limit(1);

    if (cached.length > 0) {
      // Return cached result as a single SSE event
      setResponseHeaders(event, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });
      return new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'cached', content: cached[0].content })}\n\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
          controller.close();
        },
      });
    }
  }

  // Fetch article
  const article = await db.select()
    .from(articles)
    .where(eq(articles.id, id))
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

  // Set SSE headers
  setResponseHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  // Return a ReadableStream that yields SSE events
  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let fullContent = '';

      try {
        const stream = provider.chatStream(messages, {
          temperature: 0.3,
          maxTokens: type === 'full' ? 8000 : 2000,
          timeout: type === 'full' ? 120000 : 60000,
        });

        for await (const chunk of stream) {
          fullContent += chunk;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`));
        }

        // Cache the full result
        if (force) {
          await db.delete(articleTranslations).where(and(
            eq(articleTranslations.articleId, id),
            eq(articleTranslations.type, type),
          ));
        }
        await db.insert(articleTranslations).values({
          articleId: id,
          type,
          content: fullContent,
          providerId: providerConfig.id,
          createdAt: Date.now(),
        });

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
      } catch (error) {
        const message = error instanceof LlmError
          ? error.message
          : (error instanceof Error ? error.message : '翻译失败');
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });
});
