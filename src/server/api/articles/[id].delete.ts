import { articles } from '~/server/database/schema';
import { createDeleteHandler } from '~/server/utils/handler-helpers';

// Cascade automatically deletes related translations, bookmarks, chats, tag_map
export default createDeleteHandler(articles, '文章');
