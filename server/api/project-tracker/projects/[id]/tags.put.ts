import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { ptProjects, ptProjectTags } from '~/server/database/schema';
import { requireNumericParam, requireEntity } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const id = requireNumericParam(event, 'id', '事项');
  const body = await readBody(event);
  const tagIds = (body.tagIds ?? []) as number[];
  const db = useDB(event);

  await requireEntity(db, ptProjects, id, '事项');

  // Full replace: delete all then insert new
  db.transaction((tx) => {
    tx.delete(ptProjectTags).where(eq(ptProjectTags.projectId, id)).run();
    for (const tagId of tagIds) {
      tx.insert(ptProjectTags).values({ projectId: id, tagId }).run();
    }
  });

  await db.update(ptProjects).set({ updatedAt: Date.now() }).where(eq(ptProjects.id, id));

  return { success: true };
});
