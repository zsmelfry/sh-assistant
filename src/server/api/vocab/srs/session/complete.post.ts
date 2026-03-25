import { useDB } from '~/server/database';
import { eq, and } from 'drizzle-orm';
import { studySessions } from '../../../../database/schemas/srs';
import { formatDate } from '../../../../utils/date';

export default defineEventHandler(async (event) => {
  const db = useDB(event);
  const today = formatDate(new Date());
  const now = Date.now();

  // Scope to active wordbook
  const activeWordbook = getActiveWordbook(db);

  const sessionResult = await db.select()
    .from(studySessions)
    .where(and(eq(studySessions.date, today), eq(studySessions.wordbookId, activeWordbook.id)))
    .limit(1);

  if (sessionResult.length === 0) {
    throw createError({ statusCode: 404, message: '今日没有学习会话' });
  }

  const session = sessionResult[0];

  if (session.completedAt) {
    return { session, alreadyCompleted: true };
  }

  const result = await db.update(studySessions)
    .set({ completedAt: now })
    .where(eq(studySessions.id, session.id))
    .returning();

  return { session: result[0], alreadyCompleted: false };
});
