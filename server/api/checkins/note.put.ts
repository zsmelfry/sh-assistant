import { and, eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { checkins } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const { habitId, date, note } = await readBody(event);

  if (!habitId || !date) {
    throw createError({ statusCode: 400, message: '缺少 habitId 或 date' });
  }

  const db = useDB();

  const existing = await db.select()
    .from(checkins)
    .where(and(eq(checkins.habitId, habitId), eq(checkins.date, date)))
    .limit(1);

  if (existing.length === 0) {
    throw createError({ statusCode: 404, message: '打卡记录不存在' });
  }

  await db.update(checkins)
    .set({ note: note || null })
    .where(and(eq(checkins.habitId, habitId), eq(checkins.date, date)));

  return { success: true, note: note || null };
});
