import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { articleBookmarks, articleTagMap, articleTags } from '~/server/database/schema';

/**
 * Enrich an article row with bookmark status and tags.
 * Shared by [id].get.ts and fetch.post.ts.
 */
export async function enrichArticleWithMeta(
  db: BetterSQLite3Database<any>,
  articleId: number,
  article: Record<string, any>,
) {
  const bookmark = await db.select()
    .from(articleBookmarks)
    .where(eq(articleBookmarks.articleId, articleId))
    .limit(1);

  const tags = await db.select({
    id: articleTags.id,
    name: articleTags.name,
    color: articleTags.color,
  })
    .from(articleTagMap)
    .innerJoin(articleTags, eq(articleTagMap.tagId, articleTags.id))
    .where(eq(articleTagMap.articleId, articleId));

  return {
    ...article,
    bookmark: bookmark.length > 0 ? bookmark[0] : null,
    tags,
  };
}
