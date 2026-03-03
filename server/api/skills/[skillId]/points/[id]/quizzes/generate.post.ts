import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smQuizzes, smTeachings } from '~/server/database/schema';
import { resolveProvider } from '~/server/utils/llm-provider';
import { resolveSkill, requirePointForSkill } from '~/server/lib/skill-learning';
import { requireNumericParam } from '~/server/utils/handler-helpers';
import { parseLlmJsonArray } from '~/server/utils/parse-llm-json';
import { LlmError } from '~/server/lib/llm';

interface QuizItem {
  type: string;
  question: string;
  options?: string[] | null;
  correctAnswer: string;
  explanation?: string;
}

export default defineEventHandler(async (event) => {
  const { skillId, config } = await resolveSkill(event);
  const id = requireNumericParam(event, 'id', '知识点');

  const body = await readBody(event);
  const { providerId } = body || {};

  const db = useDB();
  const { point, topic, domain } = await requirePointForSkill(db, id, skillId);

  // Load teaching content
  const [teaching] = await db.select().from(smTeachings)
    .where(eq(smTeachings.pointId, id)).limit(1);

  if (!teaching) {
    throw createError({ statusCode: 400, message: '请先生成教学内容' });
  }

  // Build teaching summary from all sections
  const teachingSummary = [teaching.what, teaching.how, teaching.example]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 4000);

  const messages = config.buildQuizPrompt({
    point, topic, domain, teachingSummary,
  });

  const { provider } = await resolveProvider(db, providerId);

  let fullContent = '';
  try {
    const stream = provider.chatStream(messages, {
      temperature: 0.5,
      maxTokens: 2000,
      timeout: 60000,
    });
    for await (const chunk of stream) {
      fullContent += chunk;
    }
  } catch (error) {
    const message = error instanceof LlmError
      ? error.message
      : (error instanceof Error ? error.message : '测验生成失败');
    throw createError({ statusCode: 502, message });
  }

  // Parse JSON array from LLM response (with robust extraction)
  let quizItems: QuizItem[];
  try {
    quizItems = parseLlmJsonArray<QuizItem>(fullContent);
  } catch {
    throw createError({ statusCode: 502, message: '测验解析失败，AI 返回格式异常' });
  }

  // Delete old quizzes and insert new ones in a transaction
  const now = Date.now();
  const inserted = db.transaction((tx) => {
    tx.delete(smQuizzes).where(eq(smQuizzes.pointId, id)).run();

    return quizItems.map((q, i) =>
      tx.insert(smQuizzes).values({
        pointId: id,
        section: 'what', // Legacy column; not used for display anymore
        type: q.type || 'multiple_choice',
        question: q.question,
        options: q.options ? JSON.stringify(q.options) : null,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || null,
        sortOrder: i,
        createdAt: now,
      }).returning().get(),
    );
  });

  // Parse options for response
  return inserted.map(q => ({
    ...q,
    options: q.options ? JSON.parse(q.options) : null,
  }));
});
