import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { plannerTags } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'));
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的标签 ID' });
  }

  const body = await readBody(event);
  if (!body.name?.trim()) {
    throw createError({ statusCode: 400, message: '标签名称不能为空' });
  }

  const db = useDB();

  const existing = await db.select().from(plannerTags).where(eq(plannerTags.id, id)).limit(1);
  if (existing.length === 0) {
    throw createError({ statusCode: 404, message: '标签不存在' });
  }

  try {
    await db.update(plannerTags)
      .set({ name: body.name.trim() })
      .where(eq(plannerTags.id, id));
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes('UNIQUE constraint failed')) {
      throw createError({ statusCode: 409, message: '标签名称已存在' });
    }
    throw e;
  }

  const [updated] = await db.select().from(plannerTags).where(eq(plannerTags.id, id)).limit(1);
  return updated;
});
