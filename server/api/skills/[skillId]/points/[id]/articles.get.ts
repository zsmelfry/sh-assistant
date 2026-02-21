import { eq, sql } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { smPointArticles, articles, articleBookmarks } from '~/server/database/schema';
import { resolveSkill, requirePointForSkill } from '~/server/lib/skill-learning';
import { requireNumericParam } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const { skillId } = await resolveSkill(event);
  const id = requireNumericParam(event, 'id', '知识点');
  const db = useDB();

  await requirePointForSkill(db, id, skillId);

  return db
    .select({
      articleId: articles.id,
      title: articles.title,
      url: articles.url,
      siteName: articles.siteName,
      bookmarkedAt: articleBookmarks.bookmarkedAt,
      linkedAt: smPointArticles.createdAt,
    })
    .from(smPointArticles)
    .innerJoin(articles, sql`${articles.id} = ${smPointArticles.articleId}`)
    .leftJoin(articleBookmarks, sql`${articleBookmarks.articleId} = ${articles.id}`)
    .where(eq(smPointArticles.pointId, id));
});
