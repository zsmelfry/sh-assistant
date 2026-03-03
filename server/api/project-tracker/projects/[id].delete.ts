import { ptProjects } from '~/server/database/schema';
import { createDeleteHandler } from '~/server/utils/handler-helpers';

export default createDeleteHandler(ptProjects, '事项');
