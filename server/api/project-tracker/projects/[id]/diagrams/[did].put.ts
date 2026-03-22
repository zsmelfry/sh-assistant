import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { ptDiagrams } from '~/server/database/schema';
import { requireNumericParam, requireEntity } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const did = requireNumericParam(event, 'did', '图表');
  const body = await readBody(event);
  const db = useDB(event);

  await requireEntity(db, ptDiagrams, did, '图表');

  const updates: Record<string, any> = { updatedAt: Date.now() };

  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (!title) throw createError({ statusCode: 400, message: '图表标题不能为空' });
    updates.title = title;
  }
  if (body.type !== undefined) updates.type = body.type;
  if (body.mermaidCode !== undefined) updates.mermaidCode = body.mermaidCode;
  if (body.description !== undefined) updates.description = body.description || null;

  await db.update(ptDiagrams).set(updates).where(eq(ptDiagrams.id, did));

  const [updated] = await db.select().from(ptDiagrams).where(eq(ptDiagrams.id, did)).limit(1);
  return updated;
});
