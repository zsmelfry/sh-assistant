import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { ptChecklistItems } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const items = body.items as { id: number; sortOrder: number; milestoneId?: number | null }[];

  if (!Array.isArray(items) || items.length === 0) {
    throw createError({ statusCode: 400, message: '排序数据不能为空' });
  }

  const db = useDB(event);
  db.transaction((tx) => {
    for (const item of items) {
      const updates: Record<string, any> = { sortOrder: item.sortOrder };
      if (item.milestoneId !== undefined) {
        updates.milestoneId = item.milestoneId || null;
      }
      tx.update(ptChecklistItems)
        .set(updates)
        .where(eq(ptChecklistItems.id, item.id))
        .run();
    }
  });

  return { success: true };
});
