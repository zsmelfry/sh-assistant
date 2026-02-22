import { useDB } from '~/server/database';
import { eq, and } from 'drizzle-orm';
import { studySessions } from '../../../../database/schemas/srs';
import { formatDate } from '../../../../utils/date';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { userId } = body;

  if (!userId || !Number.isInteger(Number(userId))) {
    throw createError({ statusCode: 400, message: 'userId 是必填参数（整数）' });
  }

  const db = useDB();
  const uid = Number(userId);
  const today = formatDate(new Date());
  const now = Date.now();

  const sessionResult = await db.select()
    .from(studySessions)
    .where(and(eq(studySessions.userId, uid), eq(studySessions.date, today)))
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
