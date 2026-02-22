import { useDB } from '~/server/database';
import { eq } from 'drizzle-orm';
import { definitions } from '../../../database/schemas/srs';
import { vocabWords } from '../../../database/schemas/vocab';
import { translateWord, cacheDefinition } from '../../../utils/translate-word';
import { requireNumericParam } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const wordId = requireNumericParam(event, 'wordId', '单词');

  const db = useDB();

  // 验证单词存在
  const wordResult = await db.select().from(vocabWords).where(eq(vocabWords.id, wordId)).limit(1);
  if (wordResult.length === 0) {
    throw createError({ statusCode: 404, message: '单词不存在' });
  }

  // 查缓存
  const cached = await db.select()
    .from(definitions)
    .where(eq(definitions.wordId, wordId))
    .limit(1);

  if (cached.length > 0) {
    const def = cached[0];
    return {
      ...def,
      examples: JSON.parse(def.examples || '[]'),
      cached: true,
    };
  }

  // 缓存未命中，直接调用翻译逻辑（不走 HTTP）
  const word = wordResult[0].word;

  try {
    const translateResult = await translateWord(db, word);
    const row = await cacheDefinition(db, wordId, translateResult);

    return {
      ...row,
      examples: translateResult.examples,
      cached: false,
    };
  } catch (error) {
    throw createError({
      statusCode: 502,
      message: `获取释义失败: ${error instanceof Error ? error.message : '未知错误'}`,
    });
  }
});
