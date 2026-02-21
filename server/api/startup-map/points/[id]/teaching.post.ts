import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smPoints, smTopics, smDomains, smTeachings, smProducts } from '~/server/database/schema';
import { resolveProvider } from '~/server/utils/llm-provider';
import { requireNumericParam } from '~/server/utils/handler-helpers';
import { LlmError } from '~/server/lib/llm';
import type { ChatMessage } from '~/server/lib/llm';

const SECTION_BREAK = '---SECTION_BREAK---';
const SECTION_KEYS = ['what', 'how', 'example', 'apply', 'resources'] as const;

function buildTeachingPrompt(
  point: { name: string; description: string | null },
  topic: { name: string },
  domain: { name: string },
  product: { name: string; description: string | null; targetMarket: string | null; targetCustomer: string | null; productionSource: string | null; currentStage: string | null; notes: string | null } | null,
): ChatMessage[] {
  let productContext = '';
  if (product) {
    productContext = `
当前学习者的产品背景：
- 产品名称：${product.name}
${product.description ? `- 产品描述：${product.description}` : ''}
${product.targetMarket ? `- 目标市场：${product.targetMarket}` : ''}
${product.targetCustomer ? `- 目标客户：${product.targetCustomer}` : ''}
${product.productionSource ? `- 生产来源：${product.productionSource}` : ''}
${product.currentStage ? `- 当前阶段：${product.currentStage}` : ''}
${product.notes ? `- 补充信息：${product.notes}` : ''}`;
  }

  return [
    {
      role: 'system',
      content: `你是一位资深的创业导师和商业教育专家。你正在为一个创业学习平台生成教学内容。
${productContext}

你需要为以下知识点生成教学内容：
- 所属领域：${domain.name}
- 所属主题：${topic.name}
- 知识点：${point.name}
${point.description ? `- 简介：${point.description}` : ''}

请按以下 5 个板块生成内容，每个板块使用 Markdown 格式。板块之间必须用 "${SECTION_BREAK}" 分隔（单独一行）：

1. **是什么 (What)** — 概念定义，重要性，在创业流程中的位置
2. **怎么做 (How)** — 通用方法论、执行步骤、常用框架和工具
3. **案例 (Example)** — 1-2 个真实品牌案例，展示知识如何在实际商业中被运用
4. **我的应用 (Apply)** — ${product ? '结合学习者的产品，' : ''}提出 2-3 个引导思考问题
5. **推荐资源 (Resources)** — 推荐书籍、网站、工具、课程

要求：
- 前 3 个板块是通用方法论（不绑定具体产品）
- 第 4 个板块针对${product ? '学习者的具体产品' : '一般创业场景'}
- 内容深入实用，不要泛泛而谈
- 每个板块 300-800 字
- 直接输出内容，不要重复板块标题`,
    },
    {
      role: 'user',
      content: `请为"${point.name}"生成教学内容。`,
    },
  ];
}

function parseSections(fullContent: string): Record<string, string> {
  const parts = fullContent.split(SECTION_BREAK).map(s => s.trim()).filter(Boolean);
  const result: Record<string, string> = {};

  for (let i = 0; i < SECTION_KEYS.length && i < parts.length; i++) {
    result[SECTION_KEYS[i]] = parts[i];
  }

  // If not enough sections (LLM didn't follow format), put all content in 'what'
  if (parts.length === 0 || parts.length === 1) {
    result.what = fullContent.trim();
  }

  return result;
}

export default defineEventHandler(async (event) => {
  const id = requireNumericParam(event, 'id', '知识点');

  const body = await readBody(event);
  const { regenerate, providerId } = body || {};

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

  // Check cache (skip in regenerate mode)
  if (!regenerate) {
    const [cached] = await db.select().from(smTeachings).where(eq(smTeachings.pointId, id)).limit(1);
    if (cached) {
      setResponseHeaders(event, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });
      return new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'cached', teaching: cached })}\n\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', teaching: cached })}\n\n`));
          controller.close();
        },
      });
    }
  }

  // Fetch active product for context
  const [activeProduct] = await db.select()
    .from(smProducts)
    .where(eq(smProducts.isActive, true))
    .limit(1);

  const messages = buildTeachingPrompt(point, topic, domain, activeProduct || null);
  const { provider, config: providerConfig } = await resolveProvider(db, providerId);

  // Set SSE headers
  setResponseHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let fullContent = '';
      let currentSectionIndex = 0;

      try {
        const stream = provider.chatStream(messages, {
          temperature: 0.3,
          maxTokens: 6000,
          timeout: 120000,
        });

        for await (const chunk of stream) {
          fullContent += chunk;

          // Track current section by counting SECTION_BREAK occurrences
          const breakCount = (fullContent.match(new RegExp(SECTION_BREAK, 'g')) || []).length;
          currentSectionIndex = Math.min(breakCount, SECTION_KEYS.length - 1);

          const currentSection = SECTION_KEYS[currentSectionIndex];
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chunk', section: currentSection, content: chunk })}\n\n`));
        }

        // Parse sections from full content
        const sections = parseSections(fullContent);
        const now = Date.now();

        // Upsert teaching record
        if (regenerate) {
          await db.delete(smTeachings).where(eq(smTeachings.pointId, id));
        }

        const [teaching] = await db.insert(smTeachings).values({
          pointId: id,
          what: sections.what || null,
          how: sections.how || null,
          example: sections.example || null,
          apply: sections.apply || null,
          resources: sections.resources || null,
          productId: activeProduct?.id || null,
          createdAt: now,
          updatedAt: now,
        }).returning();

        // Auto-set status to 'learning' if currently 'not_started'
        if (point.status === 'not_started') {
          await db.update(smPoints).set({
            status: 'learning',
            statusUpdatedAt: now,
          }).where(eq(smPoints.id, id));
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', teaching })}\n\n`));
      } catch (error) {
        const message = error instanceof LlmError
          ? error.message
          : (error instanceof Error ? error.message : '教学内容生成失败');
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });
});
