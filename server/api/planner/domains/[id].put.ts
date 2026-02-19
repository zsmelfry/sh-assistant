import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { plannerDomains } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'));
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的领域 ID' });
  }

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
