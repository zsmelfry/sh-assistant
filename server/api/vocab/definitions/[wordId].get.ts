import { eq } from 'drizzle-orm';
import { definitions } from '../../../database/schemas/srs';
import { vocabWords } from '../../../database/schemas/vocab';
import type { TranslateResult } from '../../../lib/llm';

export default defineEventHandler(async (event) => {
  const wordId = Number(getRouterParam(event, 'wordId'));
  if (!wordId || isNaN(wordId)) {
    throw createError({ statusCode: 400, message: '无效的 wordId' });
  }

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

  // 缓存未命中，调用 LLM translate API
  const word = wordResult[0].word;

  try {
    const authHeader = getRequestHeader(event, 'authorization');
    const translateResult = await $fetch('/api/llm/translate', {
      method: 'POST',
      body: { word },
      headers: authHeader ? { authorization: authHeader } : {},
    }) as TranslateResult;

    // 缓存到数据库
    const now = Date.now();
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
      cached: false,
    };
  } catch (error) {
    throw createError({
      statusCode: 502,
      message: `获取释义失败: ${error instanceof Error ? error.message : '未知错误'}`,
    });
  }
});
