import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { plannerCheckitems } from '~/server/database/schema';
import { requireNumericParam } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const id = requireNumericParam(event, 'id', '检查项');
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
