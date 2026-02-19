import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { plannerCheckitems } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'));
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的检查项 ID' });
  }

  const db = useDB();

  const existing = await db.select().from(plannerCheckitems).where(eq(plannerCheckitems.id, id)).limit(1);
  if (existing.length === 0) {
    throw createError({ statusCode: 404, message: '检查项不存在' });
  }

  await db.delete(plannerCheckitems).where(eq(plannerCheckitems.id, id));
  return { success: true };
});
