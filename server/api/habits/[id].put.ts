import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { habits } from '~/server/database/schema';
import { requireEntity, requireNonEmpty } from '~/server/utils/handler-helpers';

const VALID_FREQUENCIES = ['daily', 'weekly', 'monthly'] as const;

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, message: '缺少习惯 ID' });
  }

  const body = await readBody(event);
  const db = useDB();
  await requireEntity(db, habits, id, '习惯');

  const updates: Record<string, unknown> = { updatedAt: Date.now() };

  if (body.name !== undefined) {
    updates.name = requireNonEmpty(body.name, '习惯名称');
  }

  if (body.frequency !== undefined) {
    if (!VALID_FREQUENCIES.includes(body.frequency)) {
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
