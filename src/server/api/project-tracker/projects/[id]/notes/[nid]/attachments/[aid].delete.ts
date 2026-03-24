import { ptAttachments } from '~/server/database/schema';
import { createDeleteHandler } from '~/server/utils/handler-helpers';

export default createDeleteHandler(ptAttachments, '附件', { paramName: 'aid' });
