import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { skillConfigs } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'));
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的 id' });
  }

  const body = await readBody(event);
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, message: '请提供更新数据' });
  }

  const db = useDB();

  // Check existence
  const [existing] = await db.select().from(skillConfigs)
    .where(eq(skillConfigs.id, id)).limit(1);
  if (!existing) {
    throw createError({ statusCode: 404, message: '技能配置不存在' });
  }

  // Build update payload (only allow known fields)
  const updates: Record<string, any> = { updatedAt: Date.now() };

  // Fields that must not be empty strings
  const requiredStringFields = [
    'name',
    'teachingSystemPrompt', 'teachingUserPrompt',
    'chatSystemPrompt', 'taskSystemPrompt', 'taskUserPrompt',
  ] as const;

  for (const field of requiredStringFields) {
    if (body[field] !== undefined) {
      if (typeof body[field] !== 'string' || body[field].trim() === '') {
        throw createError({ statusCode: 400, message: `${field} 不能为空` });
      }
      updates[field] = body[field];
    }
  }

  // Optional fields
  const optionalFields = ['description', 'icon', 'sortOrder', 'isActive'] as const;
  for (const field of optionalFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  const [updated] = await db.update(skillConfigs)
    .set(updates)
    .where(eq(skillConfigs.id, id))
    .returning();

  return updated;
});
