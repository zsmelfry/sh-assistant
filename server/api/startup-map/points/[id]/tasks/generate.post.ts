import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smPoints, smTopics, smDomains, smTasks, smProducts } from '~/server/database/schema';
import { resolveProvider } from '~/server/utils/llm-provider';
import { LlmError } from '~/server/lib/llm';
import type { ChatMessage } from '~/server/lib/llm';

function buildTaskPrompt(
  point: { name: string; description: string | null },
  topic: { name: string },
  domain: { name: string },
  product: { name: string; description: string | null; targetMarket: string | null; targetCustomer: string | null } | null,
): ChatMessage[] {
  let productContext = '';
  if (product) {
    productContext = `
学习者的产品背景：
- 产品名称：${product.name}
${product.description ? `- 产品描述：${product.description}` : ''}
${product.targetMarket ? `- 目标市场：${product.targetMarket}` : ''}
${product.targetCustomer ? `- 目标客户：${product.targetCustomer}` : ''}`;
  }

  return [
    {
      role: 'system',
      content: `你是一位资深的创业导师。你需要为创业学习平台的知识点生成实践任务。
${productContext}

知识点信息：
- 所属领域：${domain.name}
- 所属主题：${topic.name}
- 知识点：${point.name}
${point.description ? `- 简介：${point.description}` : ''}

请生成 2-3 个实践任务，每个任务帮助学习者将这个知识点应用到${product ? '自己的产品' : '实际创业场景'}中。

严格按以下 JSON 格式输出（不要添加任何其他文字）：
[
  {
    "description": "任务描述（1-2句话，说明要做什么）",
    "expectedOutput": "预期产出（具体要交付什么）",
    "hint": "参考提示（帮助完成任务的建议）"
  }
]

要求：
- 任务要具体可执行，不要太抽象
- 预期产出要明确可衡量
- 参考提示要实用`,
    },
    {
      role: 'user',
      content: `请为"${point.name}"生成实践任务。`,
    },
  ];
}

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'));
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的知识点 ID' });
  }

  const body = await readBody(event);
  const { providerId } = body || {};

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

  if (!topic || !domain) {
    throw createError({ statusCode: 500, message: '知识点数据不完整' });
  }

  // Fetch active product for context
  const [activeProduct] = await db.select()
    .from(smProducts)
    .where(eq(smProducts.isActive, true))
    .limit(1);

  const messages = buildTaskPrompt(point, topic, domain, activeProduct || null);
  const { provider } = await resolveProvider(db, providerId);

  let fullContent = '';
  try {
    const stream = provider.chatStream(messages, {
      temperature: 0.3,
      maxTokens: 2000,
      timeout: 60000,
    });

    for await (const chunk of stream) {
      fullContent += chunk;
    }
  } catch (error) {
    const message = error instanceof LlmError
      ? error.message
      : (error instanceof Error ? error.message : '任务生成失败');
    throw createError({ statusCode: 502, message });
  }

  // Parse JSON from LLM response
  let tasks: Array<{ description: string; expectedOutput?: string; hint?: string }>;
  try {
    // Extract JSON array from response (handle markdown code blocks)
    const jsonMatch = fullContent.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array found');
    tasks = JSON.parse(jsonMatch[0]);
  } catch {
    throw createError({ statusCode: 502, message: '任务解析失败，AI 返回格式异常' });
  }

  // Insert tasks in a transaction
  const now = Date.now();
  const inserted = db.transaction((tx) => {
    return tasks.map((task, i) =>
      tx.insert(smTasks).values({
        pointId: id,
        description: task.description,
        expectedOutput: task.expectedOutput || null,
        hint: task.hint || null,
        sortOrder: i,
        createdAt: now,
        updatedAt: now,
      }).returning().get(),
    );
  });

  return inserted;
});
