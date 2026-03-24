import { plannerCheckitems } from '~/server/database/schema';
import { createReorderHandler } from '~/server/utils/reorder-handler';

export default createReorderHandler(plannerCheckitems);
