import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { articleTags } from '~/server/database/schema';
import { requireNumericParam } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const id = requireNumericParam(event, 'id', '标签');
  const body = await readBody(event);
  const { name, color } = body || {};

  if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
    throw createError({ statusCode: 400, message: '标签名称不能为空' });
  }

  if (color !== undefined && color !== null && typeof color !== 'string') {
    throw createError({ statusCode: 400, message: 'color 必须是字符串或 null' });
  }

  const db = useDB();

  // Check existence
  const existing = await db.select({ id: articleTags.id })
    .from(articleTags)
    .where(eq(articleTags.id, id))
    .limit(1);

  if (existing.length === 0) {
    throw createError({ statusCode: 404, message: '标签不存在' });
  }

  const updates: Record<string, any> = {};
  if (name !== undefined) updates.name = name.trim();
  if (color !== undefined) updates.color = color;

  if (Object.keys(updates).length === 0) {
    throw createError({ statusCode: 400, message: '没有需要更新的字段' });
  }

  try {
    const result = await db.update(articleTags)
      .set(updates)
      .where(eq(articleTags.id, id))
      .returning();

    return result[0];
  } catch (error: any) {
    if (error?.message?.includes('UNIQUE constraint failed')) {
      throw createError({ statusCode: 409, message: '标签名称已存在' });
    }
    throw error;
  }
});
