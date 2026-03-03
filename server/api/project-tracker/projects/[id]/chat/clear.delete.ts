import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { ptChats, ptProjects } from '~/server/database/schema';
import { requireNumericParam, requireEntity } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const projectId = requireNumericParam(event, 'id', '事项');
  const db = useDB();
  await requireEntity(db, ptProjects, projectId, '事项');

  await db.delete(ptChats).where(eq(ptChats.projectId, projectId));

  return { success: true };
});
