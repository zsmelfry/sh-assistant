import { plannerCheckitems } from '~/server/database/schema';
import { createDeleteHandler } from '~/server/utils/handler-helpers';

export default createDeleteHandler(plannerCheckitems, '检查项');
