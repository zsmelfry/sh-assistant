import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { plannerCheckitems } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const { id } = await readBody(event);

  if (!id || typeof id !== 'number') {
    throw createError({ statusCode: 400, message: '缺少检查项 ID' });
  }

  const db = useDB();

  const [existing] = await db.select().from(plannerCheckitems).where(eq(plannerCheckitems.id, id)).limit(1);
  if (!existing) {
    throw createError({ statusCode: 404, message: '检查项不存在' });
  }

  const now = Date.now();
  const newCompleted = !existing.isCompleted;

  await db.update(plannerCheckitems).set({
    isCompleted: newCompleted,
    completedAt: newCompleted ? now : null,
    updatedAt: now,
  }).where(eq(plannerCheckitems.id, id));

  return {
    id,
    isCompleted: newCompleted,
    completedAt: newCompleted ? now : null,
  };
});
