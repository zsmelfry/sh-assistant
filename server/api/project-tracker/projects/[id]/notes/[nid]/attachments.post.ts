import { useDB } from '~/server/database';
import { ptAttachments, ptNotes } from '~/server/database/schema';
import { requireNumericParam, requireEntity } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const nid = requireNumericParam(event, 'nid', '笔记');
  const body = await readBody(event);
  const db = useDB();

  await requireEntity(db, ptNotes, nid, '笔记');

  const type = body.type;
  if (!['url', 'image'].includes(type)) {
    throw createError({ statusCode: 400, message: '附件类型必须是 url 或 image' });
  }

  if (type === 'url' && !body.url) {
    throw createError({ statusCode: 400, message: 'URL 不能为空' });
  }

  if (type === 'image' && !body.filePath) {
    throw createError({ statusCode: 400, message: '文件路径不能为空' });
  }

  const [inserted] = await db.insert(ptAttachments).values({
    noteId: nid,
    type,
    url: body.url || null,
    filePath: body.filePath || null,
    caption: body.caption || null,
    createdAt: Date.now(),
  }).returning();

  setResponseStatus(event, 201);
  return inserted;
});
