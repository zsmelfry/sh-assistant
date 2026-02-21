import { eq, and, isNull } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smPoints, smNotes } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'));
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的知识点 ID' });
  }

  const db = useDB();

  // Verify point exists
  const [point] = await db.select({ id: smPoints.id })
    .from(smPoints)
    .where(eq(smPoints.id, id))
    .limit(1);

  if (!point) {
    throw createError({ statusCode: 404, message: '知识点不存在' });
  }

  // Support productId query param for P2 multi-product
  const query = getQuery(event);
  const productId = query.productId ? Number(query.productId) : null;

  const [note] = await db.select()
    .from(smNotes)
    .where(and(
      eq(smNotes.pointId, id),
      productId ? eq(smNotes.productId, productId) : isNull(smNotes.productId),
    ))
    .limit(1);

  return note || null;
});
