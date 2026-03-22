import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { ptMilestones, ptProjects } from '~/server/database/schema';
import { requireNumericParam, requireEntity } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const id = requireNumericParam(event, 'id', '事项');
  const db = useDB(event);
  await requireEntity(db, ptProjects, id, '事项');

  return db.select().from(ptMilestones)
    .where(eq(ptMilestones.projectId, id))
    .orderBy(ptMilestones.sortOrder);
});
