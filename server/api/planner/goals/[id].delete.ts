import { plannerGoals } from '~/server/database/schema';
import { createDeleteHandler } from '~/server/utils/handler-helpers';

export default createDeleteHandler(plannerGoals, '目标');
