import { eq, sql } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { milestones, skills, VALID_MILESTONE_TYPES, VALID_VERIFY_METHODS } from '~/server/database/schema';
import { requireNumericParam, requireNonEmpty, requireEntity } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const skillId = requireNumericParam(event, 'skillId', '技能');
  const body = await readBody(event);
  const db = useDB(event);

  await requireEntity(db, skills, skillId, '技能');

  const title = requireNonEmpty(body.title, '里程碑标题');
  const tier = Number(body.tier);
  if (!tier || tier < 1 || tier > 5) {
    throw createError({ statusCode: 400, message: '段位必须在 1-5 之间' });
  }

  if (!VALID_MILESTONE_TYPES.includes(body.milestoneType)) {
    throw createError({ statusCode: 400, message: '无效的里程碑类型' });
  }

  if (!VALID_VERIFY_METHODS.includes(body.verifyMethod)) {
    throw createError({ statusCode: 400, message: '无效的验证方式' });
  }

  // Get next sortOrder for this tier
  const [maxRow] = await db
    .select({ max: sql<number>`coalesce(max(${milestones.sortOrder}), -1)` })
    .from(milestones)
    .where(eq(milestones.skillId, skillId));

  const now = Date.now();
  const [inserted] = await db.insert(milestones).values({
    skillId,
    tier,
    title,
    description: body.description || null,
    milestoneType: body.milestoneType,
    verifyMethod: body.verifyMethod,
    verifyConfig: body.verifyConfig ? JSON.stringify(body.verifyConfig) : null,
    sortOrder: maxRow.max + 1,
    createdAt: now,
    updatedAt: now,
  }).returning();

  setResponseStatus(event, 201);
  return inserted;
});
