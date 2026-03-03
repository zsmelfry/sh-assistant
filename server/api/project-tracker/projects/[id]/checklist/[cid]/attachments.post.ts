import { useDB } from '~/server/database';
import { ptChecklistAttachments, ptChecklistItems } from '~/server/database/schema';
import { requireNumericParam, requireEntity } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const cid = requireNumericParam(event, 'cid', '任务');
  const body = await readBody(event);
  const db = useDB();

  await requireEntity(db, ptChecklistItems, cid, '任务');

  const type = body.type;
  if (!['url', 'image', 'file'].includes(type)) {
    throw createError({ statusCode: 400, message: '附件类型必须是 url、image 或 file' });
  }

  if (type === 'url' && !body.url) {
    throw createError({ statusCode: 400, message: 'URL 不能为空' });
  }

  if ((type === 'image' || type === 'file') && !body.filePath) {
    throw createError({ statusCode: 400, message: '文件路径不能为空' });
  }

  const [inserted] = await db.insert(ptChecklistAttachments).values({
    checklistItemId: cid,
    type,
    url: body.url || null,
    filePath: body.filePath || null,
    originalName: body.originalName || null,
    caption: body.caption || null,
    createdAt: Date.now(),
  }).returning();

  setResponseStatus(event, 201);
  return inserted;
});
