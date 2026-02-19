import { useDB } from '~/server/database';
import { plannerTags } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body.name?.trim()) {
    throw createError({ statusCode: 400, message: '标签名称不能为空' });
  }

  const db = useDB();

  try {
    const [inserted] = await db.insert(plannerTags).values({
      name: body.name.trim(),
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
