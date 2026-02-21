import { eq, asc } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smPoints, smTopics, smDomains, smTeachings, smChats, smProducts } from '~/server/database/schema';
import { resolveProvider } from '~/server/utils/llm-provider';
import { requireNumericParam } from '~/server/utils/handler-helpers';
import { LlmError } from '~/server/lib/llm';
import type { ChatMessage } from '~/server/lib/llm';

export default defineEventHandler(async (event) => {
  const id = requireNumericParam(event, 'id', '知识点');

  const body = await readBody(event);
  const { message, providerId } = body || {};

  if (!message || typeof message !== 'string' || !message.trim()) {
    throw createError({ statusCode: 400, message: '消息内容不能为空' });
  }

  const db = useDB();

  // Fetch point + topic + domain
  const [point] = await db.select().from(smPoints).where(eq(smPoints.id, id)).limit(1);
  if (!point) {
    throw createError({ statusCode: 404, message: '知识点不存在' });
  }

  const [topic] = await db.select().from(smTopics).where(eq(smTopics.id, point.topicId)).limit(1);
  const [domain] = topic
    ? await db.select().from(smDomains).where(eq(smDomains.id, topic.domainId)).limit(1)
    : [null];

  // Fetch teaching content summary
  const [teaching] = await db.select().from(smTeachings).where(eq(smTeachings.pointId, id)).limit(1);
  const teachingSummary = teaching
    ? [teaching.what, teaching.how].filter(Boolean).join('\n').slice(0, 2000)
    : '';

  // Fetch active product
  const [activeProduct] = await db.select()
    .from(smProducts)
    .where(eq(smProducts.isActive, true))
    .limit(1);

  // Build system message
  let productContext = '';
  if (activeProduct) {
    productContext = `\n\n用户的产品背景：
- 产品：${activeProduct.name}${activeProduct.description ? ` — ${activeProduct.description}` : ''}
${activeProduct.targetMarket ? `- 目标市场：${activeProduct.targetMarket}` : ''}
${activeProduct.targetCustomer ? `- 目标客户：${activeProduct.targetCustomer}` : ''}`;
  }

  const systemMessage: ChatMessage = {
    role: 'system',
    content: `你是一位经验丰富的创业导师。用户正在学习以下创业知识点，请帮助用户深入理解并应用到实际场景中。

知识点信息：
- 领域：${domain?.name || '未知'}
- 主题：${topic?.name || '未知'}
- 知识点：${point.name}${point.description ? ` — ${point.description}` : ''}
${teachingSummary ? `\n该知识点的教学内容摘要：\n${teachingSummary}` : ''}${productContext}

你的角色：
1. 回答用户关于该知识点的疑问
2. 针对用户的产品场景提出思考问题
3. 纠正可能的误解
4. 建议下一步行动
5. 在合适时推荐相关的其他知识点`,
  };

  // Load chat history
  const history = await db.select()
    .from(smChats)
    .where(eq(smChats.pointId, id))
    .orderBy(asc(smChats.createdAt));

  // Build messages: system + history + new user message
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

    // Save user message and assistant response
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
