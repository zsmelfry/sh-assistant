import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { articles, articleChats } from '~/server/database/schema';
import { requireNumericParam, requireEntity } from '~/server/utils/handler-helpers';
import { stripHtmlTags } from '~/server/utils/article-sanitizer';
import { handleChatRequest } from '~/server/utils/chat-handler';

export default defineEventHandler(async (event) => {
  const id = requireNumericParam(event, 'id', '文章');

  const body = await readBody(event);
  const { message, providerId } = body || {};

  if (!message || typeof message !== 'string' || !message.trim()) {
    throw createError({ statusCode: 400, message: '消息内容不能为空' });
  }

  const db = useDB();
  const article = await requireEntity<{ id: number; title: string; content: string }>(db, articles, id, '文章');

  // Build system context from article content
  const plainText = stripHtmlTags(article.content);
  const maxChars = 20000;
  const truncated = plainText.length > maxChars
    ? plainText.slice(0, maxChars) + '\n\n[... 文章过长，已截断]'
    : plainText;

  return handleChatRequest({
    db,
    message,
    providerId,
    systemMessage: {
      role: 'system',
      content: `你是一个智能文章助手。用户正在阅读以下文章，请根据文章内容回答用户的问题。如果问题与文章无关，也可以正常回答。

文章标题：${article.title}

文章内容：
${truncated}`,
    },
    chatTable: articleChats,
    historyWhere: eq(articleChats.articleId, id),
    insertFields: { articleId: id },
  });
});
