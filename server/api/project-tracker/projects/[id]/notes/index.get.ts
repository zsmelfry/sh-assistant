import { eq, desc } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { ptNotes, ptProjects } from '~/server/database/schema';
import { requireNumericParam, requireEntity } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const projectId = requireNumericParam(event, 'id', '事项');
  const db = useDB();
  await requireEntity(db, ptProjects, projectId, '事项');

  return db.select().from(ptNotes)
    .where(eq(ptNotes.projectId, projectId))
    .orderBy(desc(ptNotes.createdAt));
});
