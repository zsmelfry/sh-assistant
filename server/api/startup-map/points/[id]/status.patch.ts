import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smPoints } from '~/server/database/schema';
import { requireNumericParam } from '~/server/utils/handler-helpers';

const VALID_STATUSES = ['not_started', 'learning', 'understood', 'practiced'] as const;

export default defineEventHandler(async (event) => {
  const id = requireNumericParam(event, 'id', '知识点');

  const body = await readBody(event);
  const { status } = body || {};

  if (!status || !VALID_STATUSES.includes(status)) {
    throw createError({
      statusCode: 400,
      message: `status 必须是 ${VALID_STATUSES.join(', ')} 之一`,
    });
  }

  const db = useDB();

  const [point] = await db.select().from(smPoints).where(eq(smPoints.id, id)).limit(1);
  if (!point) {
    throw createError({ statusCode: 404, message: '知识点不存在' });
  }

  await db.update(smPoints).set({
    status,
    statusUpdatedAt: Date.now(),
  }).where(eq(smPoints.id, id));

  const [updated] = await db.select().from(smPoints).where(eq(smPoints.id, id)).limit(1);
  return updated;
});
