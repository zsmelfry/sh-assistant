import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { plannerDomains } from '~/server/database/schema';
import { requireNumericParam } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const id = requireNumericParam(event, 'id', '领域');
  const body = await readBody(event);
  if (!body.name?.trim()) {
    throw createError({ statusCode: 400, message: '领域名称不能为空' });
  }

  const db = useDB();

  const existing = await db.select().from(plannerDomains).where(eq(plannerDomains.id, id)).limit(1);
  if (existing.length === 0) {
    throw createError({ statusCode: 404, message: '领域不存在' });
  }

  await db.update(plannerDomains)
    .set({ name: body.name.trim(), updatedAt: Date.now() })
    .where(eq(plannerDomains.id, id));

  const [updated] = await db.select().from(plannerDomains).where(eq(plannerDomains.id, id)).limit(1);
  return updated;
});
