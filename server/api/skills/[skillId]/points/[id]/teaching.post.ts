import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smPoints, smTeachings } from '~/server/database/schema';
import { resolveProvider } from '~/server/utils/llm-provider';
import { resolveSkill, requirePointForSkill } from '~/server/lib/skill-learning';
import { requireNumericParam } from '~/server/utils/handler-helpers';
import { LlmError } from '~/server/lib/llm';

const SECTION_BREAK = '---SECTION_BREAK---';
const SECTION_KEYS = ['what', 'how', 'example', 'apply', 'resources'] as const;

function parseSections(fullContent: string): Record<string, string> {
  const parts = fullContent.split(SECTION_BREAK).map(s => s.trim()).filter(Boolean);
  const result: Record<string, string> = {};

  for (let i = 0; i < SECTION_KEYS.length && i < parts.length; i++) {
    result[SECTION_KEYS[i]] = parts[i];
  }

  if (parts.length === 0 || parts.length === 1) {
    result.what = fullContent.trim();
  }

  return result;
}

export default defineEventHandler(async (event) => {
  const db = useDB(event);
  const { skillId, config } = await resolveSkill(db, event);
  const id = requireNumericParam(event, 'id', '知识点');

  const body = await readBody(event);
  const { regenerate, providerId } = body || {};
  const { point, topic, domain } = await requirePointForSkill(db, id, skillId);

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

  const messages = config.buildTeachingPrompt({ point, topic, domain });
  const { provider } = await resolveProvider(db, providerId);

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

          const breakCount = (fullContent.match(new RegExp(SECTION_BREAK, 'g')) || []).length;
          currentSectionIndex = Math.min(breakCount, SECTION_KEYS.length - 1);

          const currentSection = SECTION_KEYS[currentSectionIndex];
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chunk', section: currentSection, content: chunk })}\n\n`));
        }

        const sections = parseSections(fullContent);
        const now = Date.now();

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
          productId: null,
          createdAt: now,
          updatedAt: now,
        }).returning();

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
