import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { checkins, habits } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const habitId = query.habitId as string;

  if (!habitId) {
    throw createError({ statusCode: 400, message: '缺少必填参数: habitId' });
  }

  const db = useDB();

  const habitRows = await db.select()
    .from(habits)
    .where(eq(habits.id, habitId))
    .limit(1);

  if (habitRows.length === 0) {
    throw createError({ statusCode: 404, message: '习惯不存在' });
  }

  const allCheckins = await db.select({ date: checkins.date })
    .from(checkins)
    .where(eq(checkins.habitId, habitId))
    .orderBy(checkins.date);

  const allDates = allCheckins.map(c => c.date);

  return { allDates };
});
