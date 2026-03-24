import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { ptProjects } from '~/server/database/schema';
import { requireNumericParam, requireEntity } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const id = requireNumericParam(event, 'id', '事项');
  const body = await readBody(event);
  const archive = body.archive !== false; // default true
  const db = useDB(event);

  await requireEntity(db, ptProjects, id, '事项');

  await db.update(ptProjects)
    .set({ archived: archive, updatedAt: Date.now() })
    .where(eq(ptProjects.id, id));

  return { success: true };
});
