import { eq, and } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smQuizzes, smQuizAttempts } from '~/server/database/schema';
import { resolveSkill, requirePointForSkill } from '~/server/lib/skill-learning';
import { requireNumericParam, requireNonEmpty } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const { skillId } = await resolveSkill(event);
  const pointId = requireNumericParam(event, 'id', '知识点');
  const quizId = requireNumericParam(event, 'quizId', '测验');

  const body = await readBody(event);
  const answer = requireNonEmpty(body?.answer, '答案');

  const db = useDB();
  await requirePointForSkill(db, pointId, skillId);

  // Verify quiz belongs to this point
  const [quiz] = await db.select().from(smQuizzes)
    .where(and(eq(smQuizzes.id, quizId), eq(smQuizzes.pointId, pointId)))
    .limit(1);

  if (!quiz) {
    throw createError({ statusCode: 404, message: '测验不存在' });
  }

  // Compare answer
  let isCorrect = false;
  if (quiz.type === 'fill_blank') {
    isCorrect = answer.trim().toLowerCase() === quiz.correctAnswer.trim().toLowerCase();
  } else {
    isCorrect = answer.trim() === quiz.correctAnswer.trim();
  }

  // Record attempt
  const attempt = db.insert(smQuizAttempts).values({
    quizId,
    userAnswer: answer,
    isCorrect,
    createdAt: Date.now(),
  }).returning().get();

  return {
    attemptId: attempt.id,
    isCorrect,
    correctAnswer: quiz.correctAnswer,
    explanation: quiz.explanation,
  };
});
