import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { ptChecklistAttachments, ptChecklistItems } from '~/server/database/schema';
import { requireNumericParam, requireEntity } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const cid = requireNumericParam(event, 'cid', '任务');
  const db = useDB();

  await requireEntity(db, ptChecklistItems, cid, '任务');

  const attachments = await db.select().from(ptChecklistAttachments)
    .where(eq(ptChecklistAttachments.checklistItemId, cid))
    .orderBy(ptChecklistAttachments.createdAt);

  return attachments;
});
