import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smQuizzes, smQuizAttempts } from '~/server/database/schema';
import { resolveSkill, requirePointForSkill } from '~/server/lib/skill-learning';
import { requireNumericParam } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const { skillId } = await resolveSkill(event);
  const id = requireNumericParam(event, 'id', '知识点');

  const db = useDB();
  await requirePointForSkill(db, id, skillId);

  const quizzes = await db.select().from(smQuizzes)
    .where(eq(smQuizzes.pointId, id))
    .orderBy(smQuizzes.sortOrder);

  // Load latest correct attempt per quiz
  const quizIds = quizzes.map(q => q.id);
  const passedQuizIds = new Set<number>();

  if (quizIds.length > 0) {
    const attempts = await db.select().from(smQuizAttempts)
      .where(eq(smQuizAttempts.isCorrect, true));

    for (const attempt of attempts) {
      if (quizIds.includes(attempt.quizId)) {
        passedQuizIds.add(attempt.quizId);
      }
    }
  }

  return quizzes.map(q => ({
    ...q,
    options: q.options ? JSON.parse(q.options) : null,
    audioSpec: q.audioSpec ? JSON.parse(q.audioSpec) : null,
    passed: passedQuizIds.has(q.id),
  }));
});
