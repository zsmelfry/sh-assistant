import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { ptNotes, ptAttachments } from '~/server/database/schema';
import { requireNumericParam, requireEntity } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const nid = requireNumericParam(event, 'nid', '笔记');
  const db = useDB();

  const note = await requireEntity<any>(db, ptNotes, nid, '笔记');

  const attachments = await db.select().from(ptAttachments)
    .where(eq(ptAttachments.noteId, nid));

  return { ...note, attachments };
});
