import { eq, and, isNull } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smPoints, smNotes } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'));
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的知识点 ID' });
  }

  const body = await readBody(event);
  if (typeof body.content !== 'string') {
    throw createError({ statusCode: 400, message: '缺少 content 字段' });
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

  const now = Date.now();
  const productId = body.productId ? Number(body.productId) : null;

  // Upsert: check existing first
  const [existing] = await db.select()
    .from(smNotes)
    .where(and(
      eq(smNotes.pointId, id),
      productId ? eq(smNotes.productId, productId) : isNull(smNotes.productId),
    ))
    .limit(1);

  if (existing) {
    const [updated] = await db.update(smNotes)
      .set({ content: body.content, updatedAt: now })
      .where(eq(smNotes.id, existing.id))
      .returning();
    return updated;
  }

  const [inserted] = await db.insert(smNotes)
    .values({
      pointId: id,
      productId,
      content: body.content,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return inserted;
});
