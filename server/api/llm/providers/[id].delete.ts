import { eq } from 'drizzle-orm';
import { llmProviders } from '../../../database/schemas/llm';
import { requireNumericParam } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const id = requireNumericParam(event, 'id', 'Provider');

  const db = useDB();

  const existing = await db.select().from(llmProviders).where(eq(llmProviders.id, id)).limit(1);
  if (existing.length === 0) {
    throw createError({ statusCode: 404, message: 'Provider 不存在' });
  }

  // 不允许删除默认 provider
  if (existing[0].isDefault) {
    throw createError({ statusCode: 400, message: '不能删除默认 Provider，请先将其他 Provider 设为默认' });
  }

  await db.delete(llmProviders).where(eq(llmProviders.id, id));

  return { success: true };
});
