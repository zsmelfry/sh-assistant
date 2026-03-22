import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smTasks } from '~/server/database/schema';
import { resolveProvider } from '~/server/utils/llm-provider';
import { resolveSkill, requirePointForSkill } from '~/server/lib/skill-learning';
import { requireNumericParam } from '~/server/utils/handler-helpers';
import { parseLlmJsonArray } from '~/server/utils/parse-llm-json';
import { LlmError } from '~/server/lib/llm';

export default defineEventHandler(async (event) => {
  const db = useDB(event);
  const { skillId, config } = await resolveSkill(db, event);
  const id = requireNumericParam(event, 'id', '知识点');

  const body = await readBody(event);
  const { providerId } = body || {};
  const { point, topic, domain } = await requirePointForSkill(db, id, skillId);

  const messages = config.buildTaskPrompt({ point, topic, domain });
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

  // Parse JSON from LLM response (with robust extraction)
  let tasks: Array<{ description: string; expectedOutput?: string; hint?: string }>;
  try {
    tasks = parseLlmJsonArray(fullContent);
    // Cap at 2 tasks max per knowledge point
    if (tasks.length > 2) tasks = tasks.slice(0, 2);
  } catch {
    throw createError({ statusCode: 502, message: '任务解析失败，AI 返回格式异常' });
  }

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
