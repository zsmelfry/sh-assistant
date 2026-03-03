import { ptNotes } from '~/server/database/schema';
import { createDeleteHandler } from '~/server/utils/handler-helpers';

export default createDeleteHandler(ptNotes, '笔记', { paramName: 'nid' });
