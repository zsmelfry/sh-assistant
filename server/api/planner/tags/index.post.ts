import { useDB } from '~/server/database';
import { plannerTags } from '~/server/database/schema';
import { requireNonEmpty } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const name = requireNonEmpty(body.name, '标签名称');

  const db = useDB();

  try {
    const [inserted] = await db.insert(plannerTags).values({
      name,
      createdAt: Date.now(),
    }).returning();

    setResponseStatus(event, 201);
    return inserted;
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes('UNIQUE constraint failed')) {
      throw createError({ statusCode: 409, message: '标签名称已存在' });
    }
    throw e;
  }
});
