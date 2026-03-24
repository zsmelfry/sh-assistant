import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smPoints } from '~/server/database/schema';
import { resolveSkill, requirePointForSkill } from '~/server/lib/skill-learning';
import { VALID_POINT_STATUSES } from '~/server/lib/skill-learning/types';
import { requireNumericParam } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const db = useDB(event);
  const { skillId } = await resolveSkill(db, event);
  const id = requireNumericParam(event, 'id', '知识点');

  const body = await readBody(event);
  const { status } = body || {};

  if (!status || !VALID_POINT_STATUSES.includes(status)) {
    throw createError({
      statusCode: 400,
      message: `status 必须是 ${VALID_POINT_STATUSES.join(', ')} 之一`,
    });
  }
  await requirePointForSkill(db, id, skillId);

  await db.update(smPoints).set({
    status,
    statusUpdatedAt: Date.now(),
  }).where(eq(smPoints.id, id));

  const [updated] = await db.select().from(smPoints).where(eq(smPoints.id, id)).limit(1);
  return updated;
});
