import { useDB } from '~/server/database';
import { eq } from 'drizzle-orm';
import { llmProviders } from '../../../database/schemas/llm';
import { requireNumericParam, requireEntity } from '~/server/utils/handler-helpers';
import { VALID_PROVIDERS } from '~/server/lib/llm/types';

export default defineEventHandler(async (event) => {
  const id = requireNumericParam(event, 'id', 'Provider');

  const body = await readBody(event);
  const { provider, name, modelName, endpoint, apiKey, isEnabled, params } = body;

  // 校验可选字段
  if (provider !== undefined && !VALID_PROVIDERS.includes(provider)) {
    throw createError({ statusCode: 400, message: `provider 必须是 ${VALID_PROVIDERS.join(', ')} 之一` });
  }
  if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
    throw createError({ statusCode: 400, message: 'name 不能为空' });
  }
  if (modelName !== undefined && (typeof modelName !== 'string' || modelName.trim().length === 0)) {
    throw createError({ statusCode: 400, message: 'modelName 不能为空' });
  }
  if (params !== undefined && params !== null && typeof params !== 'string') {
    throw createError({ statusCode: 400, message: 'params 必须是 JSON 字符串' });
  }
  if (params) {
    try {
      JSON.parse(params);
    } catch {
      throw createError({ statusCode: 400, message: 'params 不是有效的 JSON' });
    }
  }

  const db = useDB();
  await requireEntity(db, llmProviders, id, 'Provider');

  // 构建更新对象
  const updates: Record<string, unknown> = { updatedAt: Date.now() };
  if (provider !== undefined) updates.provider = provider.trim();
  if (name !== undefined) updates.name = name.trim();
  if (modelName !== undefined) updates.modelName = modelName.trim();
  if (endpoint !== undefined) updates.endpoint = endpoint?.trim() || null;
  if (apiKey !== undefined) updates.apiKey = apiKey || null;
  if (isEnabled !== undefined) updates.isEnabled = !!isEnabled;
  if (params !== undefined) updates.params = params || '{}';

  const result = await db.update(llmProviders)
    .set(updates)
    .where(eq(llmProviders.id, id))
    .returning();

  // 脱敏
  const updated = result[0];
  return {
    ...updated,
    apiKey: updated.apiKey ? `****${updated.apiKey.slice(-4)}` : null,
  };
});
