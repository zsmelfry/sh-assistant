import { useDB } from '~/server/database';
import { ptNotes, ptProjects } from '~/server/database/schema';
import { requireNumericParam, requireNonEmpty, requireEntity } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const projectId = requireNumericParam(event, 'id', '事项');
  const body = await readBody(event);
  const title = requireNonEmpty(body.title, '笔记标题');
  const db = useDB(event);

  await requireEntity(db, ptProjects, projectId, '事项');

  const now = Date.now();
  const [inserted] = await db.insert(ptNotes).values({
    projectId,
    title,
    content: body.content || null,
    createdAt: now,
    updatedAt: now,
  }).returning();

  setResponseStatus(event, 201);
  return inserted;
});
