import { translateArticle } from '~/server/utils/article-translator';
import type { TranslationType } from '~/server/utils/article-translator';
import { requireNumericParam, throwLlmError } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const id = requireNumericParam(event, 'id', '文章');

  const body = await readBody(event);
  const { type, providerId, force } = body;

  const validTypes = ['full', 'summary', 'both'];
  if (!type || !validTypes.includes(type)) {
    throw createError({
      statusCode: 400,
      message: `type 必须是 ${validTypes.join(', ')} 之一`,
    });
  }

  const db = useDB();

  try {
    if (type === 'both') {
      // 并行翻译两种类型
      const [full, summary] = await Promise.all([
        translateArticle(db, id, 'full', { providerId, force }),
        translateArticle(db, id, 'summary', { providerId, force }),
      ]);
      return {
        full: { content: full.content, cached: full.cached },
        summary: { content: summary.content, cached: summary.cached },
      };
    }

    const result = await translateArticle(db, id, type as TranslationType, { providerId, force });
    return {
      [type]: { content: result.content, cached: result.cached },
    };
  } catch (error) {
    throwLlmError(error, '翻译失败');
  }
});
