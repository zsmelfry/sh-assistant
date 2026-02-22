import { eq, asc } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smTeachings, smChats } from '~/server/database/schema';
import { resolveProvider } from '~/server/utils/llm-provider';
import { resolveSkill, requirePointForSkill } from '~/server/lib/skill-learning';
import { requireNumericParam } from '~/server/utils/handler-helpers';
import { LlmError } from '~/server/lib/llm';
import type { ChatMessage } from '~/server/lib/llm';

export default defineEventHandler(async (event) => {
  const { skillId, config } = await resolveSkill(event);
  const id = requireNumericParam(event, 'id', '知识点');

  const body = await readBody(event);
  const { message, providerId } = body || {};

  if (!message || typeof message !== 'string' || !message.trim()) {
    throw createError({ statusCode: 400, message: '消息内容不能为空' });
  }

  const db = useDB();
  const { point, topic, domain } = await requirePointForSkill(db, id, skillId);

  // Fetch teaching content summary
  const [teaching] = await db.select().from(smTeachings).where(eq(smTeachings.pointId, id)).limit(1);
  const teachingSummary = teaching
    ? [teaching.what, teaching.how].filter(Boolean).join('\n').slice(0, 2000)
    : '';

  const systemMessage = config.buildChatSystemMessage({
    point, topic, domain, teachingSummary,
  });

  // Load chat history
  const history = await db.select()
    .from(smChats)
    .where(eq(smChats.pointId, id))
    .orderBy(asc(smChats.createdAt));

  const messages: ChatMessage[] = [
    systemMessage,
    ...history.map(h => ({ role: h.role as ChatMessage['role'], content: h.content })),
    { role: 'user' as const, content: message.trim() },
  ];

  const { provider, config: providerConfig } = await resolveProvider(db, providerId);

  try {
    const responseContent = await provider.chat(messages, {
      temperature: 0.7,
      maxTokens: 4000,
      timeout: 60000,
    });

    const now = Date.now();
    const [userMsg] = await db.insert(smChats).values({
      pointId: id,
      role: 'user',
      content: message.trim(),
      createdAt: now,
    }).returning();

    const [assistantMsg] = await db.insert(smChats).values({
      pointId: id,
      role: 'assistant',
      content: responseContent,
      createdAt: now + 1,
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
