import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smProducts } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'));
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的产品 ID' });
  }

  const db = useDB();

  const [target] = await db.select().from(smProducts).where(eq(smProducts.id, id)).limit(1);
  if (!target) {
    throw createError({ statusCode: 404, message: '产品不存在' });
  }

  // Transaction: deactivate all, then activate target
  db.transaction((tx) => {
    tx.update(smProducts)
      .set({ isActive: false, updatedAt: Date.now() })
      .where(eq(smProducts.isActive, true))
      .run();

    tx.update(smProducts)
      .set({ isActive: true, updatedAt: Date.now() })
      .where(eq(smProducts.id, id))
      .run();
  });

  const [updated] = await db.select().from(smProducts).where(eq(smProducts.id, id)).limit(1);
  return updated;
});
