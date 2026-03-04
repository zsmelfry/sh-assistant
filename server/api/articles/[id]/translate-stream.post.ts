import { useDB } from '~/server/database';
import { requireNumericParam } from '~/server/utils/handler-helpers';
import {
  checkTranslationCache,
  prepareTranslation,
  saveTranslationCache,
} from '~/server/utils/article-translator';
import type { TranslationType } from '~/server/utils/article-translator';
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
    const cached = await checkTranslationCache(db, id, type as TranslationType);
    if (cached) {
      setResponseHeaders(event, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });
      return new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'cached', content: cached })}\n\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
          controller.close();
        },
      });
    }
  }

  const { messages, provider, providerConfig, chatOptions } = await prepareTranslation(db, id, type as TranslationType, providerId);

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
        const stream = provider.chatStream(messages, chatOptions);

        for await (const chunk of stream) {
          fullContent += chunk;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`));
        }

        await saveTranslationCache(db, id, type as TranslationType, fullContent, providerConfig.id, force);
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
