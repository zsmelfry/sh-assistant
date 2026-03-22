import { eq, and, isNull } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smNotes } from '~/server/database/schema';
import { resolveSkill, requirePointForSkill } from '~/server/lib/skill-learning';
import { requireNumericParam } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const { skillId } = await resolveSkill(db, event);
  const id = requireNumericParam(event, 'id', '知识点');

  await requirePointForSkill(db, id, skillId);

  // Support productId query param for multi-product (startup-map)
  const query = getQuery(event);
  const productId = query.productId ? Number(query.productId) : null;

  const [note] = await db.select()
    .from(smNotes)
    .where(and(
      eq(smNotes.pointId, id),
      productId !== null ? eq(smNotes.productId, productId) : isNull(smNotes.productId),
    ))
    .limit(1);

  return note || null;
});
