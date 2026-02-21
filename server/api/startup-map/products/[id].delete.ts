import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smProducts, smNotes } from '~/server/database/schema';
import { requireNumericParam } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const id = requireNumericParam(event, 'id', '产品');

  const db = useDB();

  const [product] = await db.select()
    .from(smProducts)
    .where(eq(smProducts.id, id))
    .limit(1);

  if (!product) {
    throw createError({ statusCode: 404, message: '产品不存在' });
  }

  if (product.isActive) {
    throw createError({ statusCode: 400, message: '不能删除当前激活的产品' });
  }

  // Delete product and cascade its notes
  db.transaction((tx) => {
    tx.delete(smNotes).where(eq(smNotes.productId, id)).run();
    tx.delete(smProducts).where(eq(smProducts.id, id)).run();
  });

  return { success: true };
});
