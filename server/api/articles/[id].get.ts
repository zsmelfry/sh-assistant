import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { articles, articleBookmarks, articleTagMap, articleTags } from '~/server/database/schema';
import { requireNumericParam, requireEntity } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const id = requireNumericParam(event, 'id', '文章');
  const db = useDB();
  const article = await requireEntity(db, articles, id, '文章');

  // Update lastReadAt timestamp (fire-and-forget)
  db.update(articles)
    .set({ lastReadAt: Date.now() })
    .where(eq(articles.id, id))
    .run();

  // 查询收藏状态
  const bookmark = await db.select()
    .from(articleBookmarks)
    .where(eq(articleBookmarks.articleId, id))
    .limit(1);

  // 查询标签
  const tagRows = await db.select({
    id: articleTags.id,
    name: articleTags.name,
    color: articleTags.color,
  })
    .from(articleTagMap)
    .innerJoin(articleTags, eq(articleTagMap.tagId, articleTags.id))
    .where(eq(articleTagMap.articleId, id));

  return {
    ...article,
    bookmark: bookmark.length > 0 ? bookmark[0] : null,
    tags: tagRows,
  };
});
