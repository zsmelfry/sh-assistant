import { eq, and } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { articles, articleTranslations } from '~/server/database/schema';
import { resolveProvider } from '~/server/utils/llm-provider';
import { requireNumericParam } from '~/server/utils/handler-helpers';
import { stripHtmlTags } from '~/server/utils/article-sanitizer';
import { buildFullTranslatePrompt, buildSummaryPrompt } from '~/server/utils/article-translator';
import { LlmError } from '~/server/lib/llm';

export default defineEventHandler(async (event) => {
  const id = requireNumericParam(event, 'id', '文章');

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
