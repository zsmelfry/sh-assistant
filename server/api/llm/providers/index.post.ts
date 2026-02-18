import { llmProviders } from '../../../database/schemas/llm';

const VALID_PROVIDERS = ['claude', 'ollama', 'openai'];

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { provider, name, modelName, endpoint, apiKey, params } = body;

  // 输入校验
  if (!provider || typeof provider !== 'string') {
    throw createError({ statusCode: 400, message: 'provider 是必填字段' });
  }
  if (!VALID_PROVIDERS.includes(provider)) {
    throw createError({ statusCode: 400, message: `provider 必须是 ${VALID_PROVIDERS.join(', ')} 之一` });
  }
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw createError({ statusCode: 400, message: 'name 是必填字段' });
  }
  if (!modelName || typeof modelName !== 'string' || modelName.trim().length === 0) {
    throw createError({ statusCode: 400, message: 'modelName 是必填字段' });
  }
  if (endpoint !== undefined && endpoint !== null && typeof endpoint !== 'string') {
    throw createError({ statusCode: 400, message: 'endpoint 必须是字符串' });
  }
  if (apiKey !== undefined && apiKey !== null && typeof apiKey !== 'string') {
    throw createError({ statusCode: 400, message: 'apiKey 必须是字符串' });
  }
  if (params !== undefined && params !== null && typeof params !== 'string') {
    throw createError({ statusCode: 400, message: 'params 必须是 JSON 字符串' });
  }

  // 如果有 params，验证是合法 JSON
  if (params) {
    try {
      JSON.parse(params);
    } catch {
      throw createError({ statusCode: 400, message: 'params 不是有效的 JSON' });
    }
  }

  const db = useDB();
  const now = Date.now();

  const result = await db.insert(llmProviders).values({
    provider: provider.trim(),
    name: name.trim(),
    modelName: modelName.trim(),
    endpoint: endpoint?.trim() || null,
    apiKey: apiKey || null,
    isDefault: false,
    isEnabled: true,
    params: params || '{}',
    createdAt: now,
    updatedAt: now,
  }).returning();

  setResponseStatus(event, 201);

  // 脱敏
  const created = result[0];
  return {
    ...created,
    apiKey: created.apiKey ? `****${created.apiKey.slice(-4)}` : null,
  };
});
