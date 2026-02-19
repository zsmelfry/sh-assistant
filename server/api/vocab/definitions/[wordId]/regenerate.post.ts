import { eq } from 'drizzle-orm';
import { definitions } from '../../../../database/schemas/srs';
import { vocabWords } from '../../../../database/schemas/vocab';
import { translateWord } from '../../../../utils/translate-word';

export default defineEventHandler(async (event) => {
  const wordId = Number(getRouterParam(event, 'wordId'));
  if (!wordId || isNaN(wordId)) {
    throw createError({ statusCode: 400, message: '无效的 wordId' });
  }

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

    const now = Date.now();

    // 删除旧缓存
    await db.delete(definitions).where(eq(definitions.wordId, wordId));

    // 插入新缓存
    const result = await db.insert(definitions).values({
      wordId,
      definition: translateResult.definition,
      partOfSpeech: translateResult.partOfSpeech,
      example: translateResult.examples[0]?.sentence || '',
      exampleTranslation: translateResult.examples[0]?.translation || '',
      examples: JSON.stringify(translateResult.examples),
      synonyms: translateResult.synonyms,
      antonyms: translateResult.antonyms,
      wordFamily: translateResult.wordFamily,
      collocations: translateResult.collocations,
      fetchedAt: now,
      modelProvider: translateResult.meta.provider,
      modelName: translateResult.meta.modelName,
    }).returning();

    return {
      ...result[0],
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
