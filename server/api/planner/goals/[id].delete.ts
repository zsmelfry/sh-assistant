import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { plannerGoals } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'));
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的目标 ID' });
  }

  const db = useDB();

  const existing = await db.select().from(plannerGoals).where(eq(plannerGoals.id, id)).limit(1);
  if (existing.length === 0) {
    throw createError({ statusCode: 404, message: '目标不存在' });
  }

  await db.delete(plannerGoals).where(eq(plannerGoals.id, id));
  return { success: true };
});
