import { skills } from '~/server/database/schema';
import { createDeleteHandler } from '~/server/utils/handler-helpers';

export default createDeleteHandler(skills, '技能', { paramName: 'skillId' });
