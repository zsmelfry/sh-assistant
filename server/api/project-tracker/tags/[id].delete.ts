import { ptTags } from '~/server/database/schema';
import { createDeleteHandler } from '~/server/utils/handler-helpers';

export default createDeleteHandler(ptTags, '标签');
