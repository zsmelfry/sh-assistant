import { articleTags } from '~/server/database/schema';
import { createDeleteHandler } from '~/server/utils/handler-helpers';

export default createDeleteHandler(articleTags, '标签');
