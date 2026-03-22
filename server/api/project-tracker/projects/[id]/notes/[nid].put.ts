import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { ptNotes } from '~/server/database/schema';
import { requireNumericParam, requireEntity } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const nid = requireNumericParam(event, 'nid', '笔记');
  const body = await readBody(event);
  const db = useDB(event);

  await requireEntity(db, ptNotes, nid, '笔记');

  const updates: Record<string, any> = { updatedAt: Date.now() };

  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (!title) throw createError({ statusCode: 400, message: '笔记标题不能为空' });
    updates.title = title;
  }
  if (body.content !== undefined) {
    updates.content = body.content || null;
  }

  await db.update(ptNotes).set(updates).where(eq(ptNotes.id, nid));

  const [updated] = await db.select().from(ptNotes).where(eq(ptNotes.id, nid)).limit(1);
  return updated;
});
