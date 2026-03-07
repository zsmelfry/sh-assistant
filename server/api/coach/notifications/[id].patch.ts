import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { coachNotifications } from '~/server/database/schema';
import { requireNumericParam } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const id = requireNumericParam(event, 'id', '通知');
  const body = await readBody(event);
  const db = useDB();

  if (!['read', 'acted', 'dismissed'].includes(body.status)) {
    throw createError({ statusCode: 400, message: '无效的状态' });
  }

  const [notification] = await db.select().from(coachNotifications)
    .where(eq(coachNotifications.id, id));
  if (!notification) {
    throw createError({ statusCode: 404, message: '通知不存在' });
  }

  const [updated] = await db.update(coachNotifications).set({
    status: body.status,
  }).where(eq(coachNotifications.id, id)).returning();

  return updated;
});
