import { useDB } from '~/server/database';
import { articleTags } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { name, color } = body || {};

  if (!name || typeof name !== 'string' || !name.trim()) {
    throw createError({ statusCode: 400, message: '标签名称不能为空' });
  }

  if (color && typeof color !== 'string') {
    throw createError({ statusCode: 400, message: 'color 必须是字符串' });
  }

  const db = useDB(event);

  try {
    const result = await db.insert(articleTags).values({
      name: name.trim(),
      color: color || null,
      createdAt: Date.now(),
    }).returning();

    setResponseStatus(event, 201);
    return result[0];
  } catch (error: any) {
    if (error?.message?.includes('UNIQUE constraint failed')) {
      throw createError({ statusCode: 409, message: '标签名称已存在' });
    }
    throw error;
  }
});
