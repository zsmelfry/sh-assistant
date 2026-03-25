import { useDB } from '~/server/database';
import { eq } from 'drizzle-orm';
import { llmProviders } from '../../../database/schemas/llm';
import { decryptApiKey } from '~/server/utils/crypto';

/** 默认 Provider 种子数据（需用户自行配置 API Key） */
const DEFAULT_PROVIDERS = [
  {
    provider: 'gemini',
    name: 'Gemini 2.5 Flash',
    modelName: '2.5-flash',
    isDefault: true,
    isEnabled: true,
    params: JSON.stringify({ temperature: 0.7, maxTokens: 2000 }),
  },
  {
    provider: 'claude-api',
    name: 'Claude Opus 4.6',
    modelName: 'claude-opus-4-6',
    isDefault: false,
    isEnabled: true,
    params: JSON.stringify({ temperature: 0.7, maxTokens: 2000 }),
  },
];

export default defineEventHandler(async (event) => {
  const db = useDB(event);

  // 检查是否为空，自动插入种子数据
  let providers = await db.select().from(llmProviders);

  if (providers.length === 0) {
    const now = Date.now();
    for (const seed of DEFAULT_PROVIDERS) {
      await db.insert(llmProviders).values({
        ...seed,
        createdAt: now,
        updatedAt: now,
      });
    }
    providers = await db.select().from(llmProviders);
  }

  // 脱敏: decrypt then mask to show last 4 of original key
  return providers.map(p => {
    let maskedKey: string | null = null;
    if (p.apiKey) {
      try {
        const plain = decryptApiKey(p.apiKey);
        maskedKey = `****${plain.slice(-4)}`;
      } catch {
        maskedKey = '****';
      }
    }
    return { ...p, apiKey: maskedKey };
  });
});
