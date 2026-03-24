import { ptChecklistItems } from '~/server/database/schema';
import { createDeleteHandler } from '~/server/utils/handler-helpers';

export default createDeleteHandler(ptChecklistItems, '任务', { paramName: 'cid' });
