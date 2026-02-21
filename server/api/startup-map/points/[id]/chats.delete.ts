import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smPoints, smChats } from '~/server/database/schema';
import { requireNumericParam } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const id = requireNumericParam(event, 'id', '知识点');

  const db = useDB();

  // Verify point exists
  const [point] = await db.select().from(smPoints).where(eq(smPoints.id, id)).limit(1);
  if (!point) {
    throw createError({ statusCode: 404, message: '知识点不存在' });
  }

  await db.delete(smChats).where(eq(smChats.pointId, id));

  return { success: true };
});
