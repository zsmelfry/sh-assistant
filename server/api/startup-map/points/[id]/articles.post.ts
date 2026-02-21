import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smPointArticles, smPoints } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'));
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的知识点 ID' });
  }

  const body = await readBody(event);
  if (!Array.isArray(body.articleIds) || body.articleIds.length === 0) {
    throw createError({ statusCode: 400, message: '缺少 articleIds 数组' });
  }

  const db = useDB();

  // Verify point exists
  const [point] = await db.select({ id: smPoints.id })
    .from(smPoints)
    .where(eq(smPoints.id, id))
    .limit(1);

  if (!point) {
    throw createError({ statusCode: 404, message: '知识点不存在' });
  }

  const now = Date.now();
  const inserted = db.transaction((tx) => {
    const results = [];
    for (const articleId of body.articleIds) {
      try {
        const [row] = tx.insert(smPointArticles)
          .values({ pointId: id, articleId: Number(articleId), createdAt: now })
          .returning().all();
        results.push(row);
      } catch {
        // Skip duplicates (composite PK conflict)
      }
    }
    return results;
  });

  return { inserted: inserted.length };
});
