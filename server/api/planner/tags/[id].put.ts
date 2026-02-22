import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { plannerTags } from '~/server/database/schema';
import { requireNumericParam, requireEntity } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const id = requireNumericParam(event, 'id', '标签');
  const body = await readBody(event);
  if (!body.name?.trim()) {
    throw createError({ statusCode: 400, message: '标签名称不能为空' });
  }

  const db = useDB();
  await requireEntity(db, plannerTags, id, '标签');

  try {
    await db.update(plannerTags)
      .set({ name: body.name.trim() })
      .where(eq(plannerTags.id, id));
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes('UNIQUE constraint failed')) {
      throw createError({ statusCode: 409, message: '标签名称已存在' });
    }
    throw e;
  }

  const [updated] = await db.select().from(plannerTags).where(eq(plannerTags.id, id)).limit(1);
  return updated;
});
