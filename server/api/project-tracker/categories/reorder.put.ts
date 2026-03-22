import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { ptCategories } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const items = body.items as { id: number; sortOrder: number }[];

  if (!Array.isArray(items) || items.length === 0) {
    throw createError({ statusCode: 400, message: '排序数据不能为空' });
  }

  const db = useDB(event);
  db.transaction((tx) => {
    for (const item of items) {
      tx.update(ptCategories)
        .set({ sortOrder: item.sortOrder })
        .where(eq(ptCategories.id, item.id))
        .run();
    }
  });

  return { success: true };
});
