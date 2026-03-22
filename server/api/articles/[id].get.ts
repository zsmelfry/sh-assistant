import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { articles } from '~/server/database/schema';
import { requireNumericParam, requireEntity } from '~/server/utils/handler-helpers';
import { enrichArticleWithMeta } from '~/server/utils/article-helpers';

export default defineEventHandler(async (event) => {
  const id = requireNumericParam(event, 'id', '文章');
  const db = useDB(event);
  const article = await requireEntity(db, articles, id, '文章');

  // Update lastReadAt timestamp (fire-and-forget)
  db.update(articles)
    .set({ lastReadAt: Date.now() })
    .where(eq(articles.id, id))
    .run();

  return enrichArticleWithMeta(db, id, article);
});
