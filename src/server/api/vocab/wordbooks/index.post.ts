import { useDB } from '~/server/database';
import { wordbooks } from '~/server/database/schemas/vocab';
import { getLanguageConfig } from '~/server/lib/vocab/languages';

export default defineEventHandler(async (event) => {
  const db = useDB(event);
  const body = await readBody(event);

  const { name, language } = body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    throw createError({ statusCode: 400, message: 'name is required' });
  }
  if (name.trim().length > 100) {
    throw createError({ statusCode: 400, message: '词汇本名称不能超过100个字符' });
  }
  if (!language || typeof language !== 'string') {
    throw createError({ statusCode: 400, message: 'language is required' });
  }

  // Validate language code exists in registry
  getLanguageConfig(language);

  // Feature gate: if multi_wordbook not enabled and a wordbook already exists, block
  const multiEnabled = isMultiWordbookEnabled(db);
  if (!multiEnabled) {
    const existing = db.select().from(wordbooks).limit(1).get();
    if (existing) {
      throw createError({
        statusCode: 403,
        message: '多词汇本功能未开启，无法创建新词汇本',
      });
    }
  }

  const now = Date.now();

  // Insert new wordbook and set as active (deactivate others)
  const created = db.transaction((tx) => {
    // Deactivate all existing wordbooks
    tx.update(wordbooks)
      .set({ isActive: false })
      .run();

    // Insert new wordbook as active
    const result = tx.insert(wordbooks)
      .values({
        name: name.trim(),
        language,
        isActive: true,
        wordCount: 0,
        createdAt: now,
      })
      .returning()
      .get();

    return result;
  });

  return created;
});
