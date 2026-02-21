import { eq } from 'drizzle-orm';
import { llmProviders } from '../../../../database/schemas/llm';
import { requireNumericParam } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const id = requireNumericParam(event, 'id', 'Provider');

  const db = useDB();

  // 检查 provider 存在且已启用
  const existing = await db.select().from(llmProviders).where(eq(llmProviders.id, id)).limit(1);
  if (existing.length === 0) {
    throw createError({ statusCode: 404, message: 'Provider 不存在' });
  }
  if (!existing[0].isEnabled) {
    throw createError({ statusCode: 400, message: '不能将已禁用的 Provider 设为默认' });
  }

  const now = Date.now();

  // 事务: 清除所有默认标记 → 设置新默认（better-sqlite3 同步事务，不能用 async）
  db.transaction((tx: any) => {
    tx.update(llmProviders)
      .set({ isDefault: false, updatedAt: now })
      .where(eq(llmProviders.isDefault, true))
      .run();

    tx.update(llmProviders)
      .set({ isDefault: true, updatedAt: now })
      .where(eq(llmProviders.id, id))
      .run();
  });

  return { success: true };
});
