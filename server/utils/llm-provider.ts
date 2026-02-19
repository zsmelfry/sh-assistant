import { eq } from 'drizzle-orm';
import { llmProviders } from '../database/schemas/llm';
import { ProviderFactory } from '../lib/llm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

/**
 * Resolve and instantiate an LLM provider from DB config.
 * Looks up by providerId, or falls back to the default provider.
 */
export async function resolveProvider(db: BetterSQLite3Database, providerId?: number | string) {
  let providerConfig;

  if (providerId) {
    const result = await db.select().from(llmProviders).where(eq(llmProviders.id, Number(providerId))).limit(1);
    if (result.length === 0) {
      throw createError({ statusCode: 404, message: '指定的 Provider 不存在' });
    }
    providerConfig = result[0];
  } else {
    const result = await db.select().from(llmProviders).where(eq(llmProviders.isDefault, true)).limit(1);
    if (result.length === 0) {
      throw createError({ statusCode: 400, message: '未配置默认 LLM Provider，请先在设置中配置' });
    }
    providerConfig = result[0];
  }

  if (!providerConfig.isEnabled) {
    throw createError({ statusCode: 400, message: '该 Provider 已被禁用' });
  }

  const provider = ProviderFactory.fromDbConfig(providerConfig);
  return { provider, config: providerConfig };
}
