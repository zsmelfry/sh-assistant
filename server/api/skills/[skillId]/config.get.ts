import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { skillConfigs } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const skillId = getRouterParam(event, 'skillId');
  if (!skillId) {
    throw createError({ statusCode: 400, message: 'skillId 不能为空' });
  }

  const db = useDB();
  const [config] = await db.select({
    features: skillConfigs.features,
  }).from(skillConfigs)
    .where(eq(skillConfigs.skillId, skillId))
    .limit(1);

  if (!config) {
    throw createError({ statusCode: 404, message: '技能配置不存在' });
  }

  return {
    features: config.features ? JSON.parse(config.features) : {},
  };
});
