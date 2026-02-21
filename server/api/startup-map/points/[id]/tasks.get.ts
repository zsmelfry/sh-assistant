import { eq, asc } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smPoints, smTasks } from '~/server/database/schema';
import { requireNumericParam } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const id = requireNumericParam(event, 'id', '知识点');

  const db = useDB();

  // Verify point exists
  const [point] = await db.select({ id: smPoints.id })
    .from(smPoints)
    .where(eq(smPoints.id, id))
    .limit(1);

  if (!point) {
    throw createError({ statusCode: 404, message: '知识点不存在' });
  }

  return db.select()
    .from(smTasks)
    .where(eq(smTasks.pointId, id))
    .orderBy(asc(smTasks.sortOrder));
});
