import { eq, and, isNull } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smNotes } from '~/server/database/schema';
import { resolveSkill, requirePointForSkill } from '~/server/lib/skill-learning';
import { requireNumericParam } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const { skillId } = await resolveSkill(event);
  const id = requireNumericParam(event, 'id', '知识点');

  const body = await readBody(event);
  if (typeof body.content !== 'string') {
    throw createError({ statusCode: 400, message: '缺少 content 字段' });
  }

  const db = useDB();
  await requirePointForSkill(db, id, skillId);

  const now = Date.now();
  // null when no product context; startup-map passes actual productId
  const productId = body.productId ? Number(body.productId) : null;

  // Upsert: check existing first
  const [existing] = await db.select()
    .from(smNotes)
    .where(and(
      eq(smNotes.pointId, id),
      productId !== null ? eq(smNotes.productId, productId) : isNull(smNotes.productId),
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
