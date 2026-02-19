import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { plannerCheckitems } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw createError({ statusCode: 400, message: '缺少排序项' });
  }

  for (const item of body.items) {
    if (typeof item.id !== 'number' || typeof item.sortOrder !== 'number') {
      throw createError({ statusCode: 400, message: '排序项格式无效' });
    }
  }

  const db = useDB();
  const now = Date.now();

  db.transaction((tx) => {
    for (const item of body.items) {
      tx.update(plannerCheckitems)
        .set({ sortOrder: item.sortOrder, updatedAt: now })
        .where(eq(plannerCheckitems.id, item.id))
        .run();
    }
  });

  return { success: true };
});
