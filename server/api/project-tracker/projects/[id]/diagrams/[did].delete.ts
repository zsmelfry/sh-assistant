import { ptDiagrams } from '~/server/database/schema';
import { createDeleteHandler } from '~/server/utils/handler-helpers';

export default createDeleteHandler(ptDiagrams, '图表', { paramName: 'did' });
