import { useDB } from '~/server/database';
import { ptTags } from '~/server/database/schema';
import { requireNonEmpty } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const name = requireNonEmpty(body.name, '标签名称');
  const db = useDB();

  const [inserted] = await db.insert(ptTags).values({
    name,
    createdAt: Date.now(),
  }).returning();

  setResponseStatus(event, 201);
  return inserted;
});
