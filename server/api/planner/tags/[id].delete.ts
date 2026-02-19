import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { plannerTags } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'));
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的标签 ID' });
  }

  const db = useDB();

  const existing = await db.select().from(plannerTags).where(eq(plannerTags.id, id)).limit(1);
  if (existing.length === 0) {
    throw createError({ statusCode: 404, message: '标签不存在' });
  }

  await db.delete(plannerTags).where(eq(plannerTags.id, id));
  return { success: true };
});
