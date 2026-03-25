import { eq, and } from 'drizzle-orm';
import { useAdminDB } from '~/server/database';
import { verificationTokens } from '~/server/database/admin-schema';

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'));
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的邀请ID' });
  }

  const db = useAdminDB();

  const result = db.delete(verificationTokens)
    .where(and(
      eq(verificationTokens.id, id),
      eq(verificationTokens.type, 'invite'),
    ))
    .run();

  if (result.changes === 0) {
    throw createError({ statusCode: 404, message: '邀请不存在' });
  }

  return { success: true };
});
