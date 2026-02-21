import { eq, asc } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { articles, articleChats } from '~/server/database/schema';
import { resolveProvider } from '~/server/utils/llm-provider';
import { requireNumericParam } from '~/server/utils/handler-helpers';
import { stripHtmlTags } from '~/server/utils/article-sanitizer';
import { LlmError } from '~/server/lib/llm';
import type { ChatMessage } from '~/server/lib/llm';

export default defineEventHandler(async (event) => {
  const id = requireNumericParam(event, 'id', '文章');

  const body = await readBody(event);
  const { message, providerId } = body || {};

  if (!message || typeof message !== 'string' || !message.trim()) {
    throw createError({ statusCode: 400, message: '消息内容不能为空' });
  }

  const db = useDB();

  // Fetch article
  const article = await db.select()
    .from(articles)
    .where(eq(articles.id, id))
    .limit(1);

  if (article.length === 0) {
    throw createError({ statusCode: 404, message: '文章不存在' });
  }

  // Build system context from article content
  const plainText = stripHtmlTags(article[0].content);
  const maxChars = 20000;
  const truncated = plainText.length > maxChars
    ? plainText.slice(0, maxChars) + '\n\n[... 文章过长，已截断]'
    : plainText;

  const systemMessage: ChatMessage = {
    role: 'system',
    content: `你是一个智能文章助手。用户正在阅读以下文章，请根据文章内容回答用户的问题。如果问题与文章无关，也可以正常回答。

文章标题：${article[0].title}

文章内容：
${truncated}`,
  };

  // Load chat history
  const history = await db.select()
    .from(articleChats)
    .where(eq(articleChats.articleId, id))
    .orderBy(asc(articleChats.createdAt));

  // Build messages array: system + history + new user message
  const messages: ChatMessage[] = [
    systemMessage,
    ...history.map(h => ({ role: h.role as ChatMessage['role'], content: h.content })),
    { role: 'user' as const, content: message.trim() },
  ];

  // Resolve LLM provider
  const { provider, config: providerConfig } = await resolveProvider(db, providerId);

  try {
    const responseContent = await provider.chat(messages, {
      temperature: 0.7,
      maxTokens: 4000,
      timeout: 60000,
    });

    // Save user message and assistant response
    const now = Date.now();
    const [userMsg] = await db.insert(articleChats).values({
      articleId: id,
      role: 'user',
      content: message.trim(),
      createdAt: now,
    }).returning();

    const [assistantMsg] = await db.insert(articleChats).values({
      articleId: id,
      role: 'assistant',
      content: responseContent,
      createdAt: now + 1, // +1ms to ensure ordering
    }).returning();

    return {
      userMessage: userMsg,
      assistantMessage: assistantMsg,
      meta: {
        provider: providerConfig.provider,
        modelName: providerConfig.modelName,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    if (error instanceof LlmError) {
      throw createError({
        statusCode: 502,
        message: error.message,
        data: { type: error.type },
      });
    }
    if ((error as any)?.statusCode) throw error;
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'AI 聊天失败',
    });
  }
});
