import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { habits } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, message: '缺少习惯 ID' });
  }

  const body = await readBody(event);
  const db = useDB();

  const existing = await db.select()
    .from(habits)
    .where(eq(habits.id, id))
    .limit(1);

  if (existing.length === 0) {
    throw createError({ statusCode: 404, message: '习惯不存在' });
  }

  const updates: Record<string, unknown> = { updatedAt: Date.now() };

  if (body.name !== undefined) {
    if (!body.name?.trim()) {
      throw createError({ statusCode: 400, message: '习惯名称不能为空' });
    }
    updates.name = body.name.trim();
  }

  if (body.frequency !== undefined) {
    const validFrequencies = ['daily', 'weekly', 'monthly'];
    if (!validFrequencies.includes(body.frequency)) {
      throw createError({ statusCode: 400, message: '无效的频率类型' });
    }
    updates.frequency = body.frequency;
  }

  await db.update(habits)
    .set(updates)
    .where(eq(habits.id, id));

  const updated = await db.select()
    .from(habits)
    .where(eq(habits.id, id))
    .limit(1);

  return updated[0];
});
