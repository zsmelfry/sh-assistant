import { ptChecklistAttachments } from '~/server/database/schema';
import { createDeleteHandler } from '~/server/utils/handler-helpers';

export default createDeleteHandler(ptChecklistAttachments, '附件', { paramName: 'aid' });
