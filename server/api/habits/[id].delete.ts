import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { habits } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, message: '缺少习惯 ID' });
  }

  const db = useDB();

  const existing = await db.select()
    .from(habits)
    .where(eq(habits.id, id))
    .limit(1);

  if (existing.length === 0) {
    throw createError({ statusCode: 404, message: '习惯不存在' });
  }

  // 级联删除打卡记录由数据库外键约束处理
  await db.delete(habits).where(eq(habits.id, id));

  return { success: true };
});
