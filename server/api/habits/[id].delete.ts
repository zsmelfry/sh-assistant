import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { habits } from '~/server/database/schema';
import { requireEntity } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, message: '缺少习惯 ID' });
  }

  const db = useDB();
  await requireEntity(db, habits, id, '习惯');

  // 级联删除打卡记录由数据库外键约束处理
  await db.delete(habits).where(eq(habits.id, id));

  return { success: true };
});
