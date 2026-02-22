import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { skillConfigs } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'));
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的 id' });
  }

  const db = useDB();
  const [row] = await db.select().from(skillConfigs)
    .where(eq(skillConfigs.id, id)).limit(1);

  if (!row) {
    throw createError({ statusCode: 404, message: '技能配置不存在' });
  }

  return row;
});
