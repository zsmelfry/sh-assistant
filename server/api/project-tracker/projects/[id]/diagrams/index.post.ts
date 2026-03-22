import { useDB } from '~/server/database';
import { ptDiagrams, ptProjects } from '~/server/database/schema';
import { requireNumericParam, requireNonEmpty, requireEntity } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const projectId = requireNumericParam(event, 'id', '事项');
  const body = await readBody(event);
  const title = requireNonEmpty(body.title, '图表标题');
  const db = useDB(event);

  await requireEntity(db, ptProjects, projectId, '事项');

  const now = Date.now();
  const [inserted] = await db.insert(ptDiagrams).values({
    projectId,
    title,
    type: body.type || 'flowchart',
    mermaidCode: body.mermaidCode || 'graph TD\n  A[开始] --> B[结束]',
    description: body.description || null,
    createdAt: now,
    updatedAt: now,
  }).returning();

  setResponseStatus(event, 201);
  return inserted;
});
