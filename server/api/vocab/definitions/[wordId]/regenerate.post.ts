import { useDB } from '~/server/database';
import { eq } from 'drizzle-orm';
import { definitions } from '../../../../database/schemas/srs';
import { vocabWords } from '../../../../database/schemas/vocab';
import { translateWord, cacheDefinition } from '../../../../utils/translate-word';
import { requireNumericParam } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const wordId = requireNumericParam(event, 'wordId', '单词');

  const body = await readBody(event);
  const { providerId } = body;

  const db = useDB();

  // 验证单词存在
  const wordResult = await db.select().from(vocabWords).where(eq(vocabWords.id, wordId)).limit(1);
  if (wordResult.length === 0) {
    throw createError({ statusCode: 404, message: '单词不存在' });
  }

  const word = wordResult[0].word;

  // 直接调用翻译逻辑（不走 HTTP）
  try {
    const translateResult = await translateWord(db, word, {
      providerId: providerId ? Number(providerId) : undefined,
    });

    // 删除旧缓存
    await db.delete(definitions).where(eq(definitions.wordId, wordId));

    const row = await cacheDefinition(db, wordId, translateResult);

    return {
      ...row,
      examples: translateResult.examples,
      regenerated: true,
    };
  } catch (error) {
    throw createError({
      statusCode: 502,
      message: `重新生成释义失败: ${error instanceof Error ? error.message : '未知错误'}`,
    });
  }
});
