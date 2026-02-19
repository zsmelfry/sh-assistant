import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { plannerCheckitems } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'));
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的检查项 ID' });
  }

  const body = await readBody(event);
  if (!body.content?.trim()) {
    throw createError({ statusCode: 400, message: '检查项内容不能为空' });
  }

  const db = useDB();

  const existing = await db.select().from(plannerCheckitems).where(eq(plannerCheckitems.id, id)).limit(1);
  if (existing.length === 0) {
    throw createError({ statusCode: 404, message: '检查项不存在' });
  }

  await db.update(plannerCheckitems)
    .set({ content: body.content.trim(), updatedAt: Date.now() })
    .where(eq(plannerCheckitems.id, id));

  const [updated] = await db.select().from(plannerCheckitems).where(eq(plannerCheckitems.id, id)).limit(1);
  return updated;
});
