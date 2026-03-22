import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smTeachings } from '~/server/database/schema';
import { resolveProvider } from '~/server/utils/llm-provider';
import { resolveSkill, requirePointForSkill } from '~/server/lib/skill-learning';
import { requireNumericParam } from '~/server/utils/handler-helpers';
import { parseLlmJsonObject } from '~/server/utils/parse-llm-json';
import { LlmError } from '~/server/lib/llm';

export default defineEventHandler(async (event) => {
  const db = useDB(event);
  const { skillId, config } = await resolveSkill(db, event);
  const id = requireNumericParam(event, 'id', '知识点');

  const body = await readBody(event);
  const { providerId } = body || {};
  const { point, topic, domain } = await requirePointForSkill(db, id, skillId);

  // Fetch teaching summary
  const [teaching] = await db.select().from(smTeachings)
    .where(eq(smTeachings.pointId, id)).limit(1);

  const teachingSummary = teaching
    ? [teaching.what, teaching.how].filter(Boolean).join('\n').slice(0, 2000)
    : '';

  if (!teachingSummary) {
    // Return default quick buttons when no teaching content
    return buildDefaultGuidance(point.name);
  }

  const messages = config.buildGuidancePrompt({
    point, topic, domain, teachingSummary,
  });

  const { provider } = await resolveProvider(db, providerId);

  let fullContent = '';
  try {
    const stream = provider.chatStream(messages, {
      temperature: 0.6,
      maxTokens: 800,
      timeout: 30000,
    });
    for await (const chunk of stream) {
      fullContent += chunk;
    }
  } catch (error) {
    // Fallback to defaults on LLM error
    return buildDefaultGuidance(point.name);
  }

  // Parse JSON (with robust extraction)
  try {
    const result = parseLlmJsonObject<{ guidingQuestions?: string[]; quickButtons?: Array<{ label: string; prompt: string }> }>(fullContent);

    return {
      guidingQuestions: Array.isArray(result.guidingQuestions) ? result.guidingQuestions : [],
      quickButtons: Array.isArray(result.quickButtons)
        ? result.quickButtons.filter((b: any) => b.label && b.prompt)
        : buildDefaultGuidance(point.name).quickButtons,
    };
  } catch {
    return buildDefaultGuidance(point.name);
  }
});

function buildDefaultGuidance(pointName: string) {
  return {
    guidingQuestions: [],
    quickButtons: [
      { label: '举个例子', prompt: `能给我举一个关于「${pointName}」的实际例子吗？` },
      { label: '简单解释', prompt: `能用更简单的话解释一下「${pointName}」吗？` },
      { label: '为什么重要', prompt: `为什么「${pointName}」很重要？` },
      { label: '常见误区', prompt: `学习「${pointName}」时有哪些常见的误区？` },
    ],
  };
}
