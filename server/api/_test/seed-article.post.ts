import { useDB } from '~/server/database';
import { articles, articleTranslations, articleBookmarks } from '~/server/database/schema';

/**
 * Test-only endpoint: seed an article (and optionally translations/bookmark) directly into the DB.
 * Skips external URL fetching and LLM calls.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  const db = useDB();
  const now = Date.now();

  // Insert article
  const articleData = {
    url: body.url || `https://example.com/test-${now}`,
    title: body.title || 'Test Article Title',
    author: body.author || 'Test Author',
    siteName: body.siteName || 'example.com',
    content: body.content || '<p>This is test article content.</p><p>Second paragraph.</p>',
    excerpt: body.excerpt || 'This is a test excerpt for the article.',
    publishedAt: body.publishedAt || now - 86_400_000,
    createdAt: body.createdAt || now,
  };

  const [article] = await db.insert(articles).values(articleData).returning();

  // Optionally seed translations
  if (body.fullTranslation) {
    await db.insert(articleTranslations).values({
      articleId: article.id,
      type: 'full',
      content: body.fullTranslation,
      createdAt: now,
    });
  }

  if (body.summaryTranslation) {
    await db.insert(articleTranslations).values({
      articleId: article.id,
      type: 'summary',
      content: body.summaryTranslation,
      createdAt: now,
    });
  }

  // Optionally seed bookmark
  if (body.bookmarked) {
    await db.insert(articleBookmarks).values({
      articleId: article.id,
      bookmarkedAt: body.bookmarkedAt || now,
    });
  }

  return article;
});
