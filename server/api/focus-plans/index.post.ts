import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { focusPlans, skills } from '~/server/database/schema';
import { requireNumericParam, requireEntity } from '~/server/utils/handler-helpers';
import { logActivity } from '~/server/lib/ability/log-activity';
import { TIER_NAMES } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const db = useDB();

  const skillId = Number(body.skillId);
  if (!skillId) {
    throw createError({ statusCode: 400, message: '请选择技能' });
  }

  const [skill] = await db.select().from(skills).where(eq(skills.id, skillId));
  if (!skill) {
    throw createError({ statusCode: 404, message: '技能不存在' });
  }

  const targetTier = Number(body.targetTier);
  if (!targetTier || targetTier < 1 || targetTier > 5) {
    throw createError({ statusCode: 400, message: '目标段位必须在 1-5 之间' });
  }
  if (targetTier <= skill.currentTier) {
    throw createError({ statusCode: 400, message: '目标段位必须高于当前段位' });
  }

  if (!body.targetDate) {
    throw createError({ statusCode: 400, message: '请设定截止日期' });
  }

  // Check max 3 active plans
  const activePlans = await db.select().from(focusPlans)
    .where(eq(focusPlans.status, 'active'));
  if (activePlans.length >= 3) {
    throw createError({ statusCode: 400, message: '最多同时拥有 3 个焦点计划' });
  }

  const now = Date.now();
  const [inserted] = await db.insert(focusPlans).values({
    skillId,
    currentTier: skill.currentTier,
    targetTier,
    targetDate: body.targetDate,
    strategy: body.strategy || null,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }).returning();

  await logActivity({
    skillId,
    categoryId: skill.categoryId,
    source: 'manual',
    description: `创建焦点计划：${skill.name} → ${TIER_NAMES[targetTier]}`,
  });

  setResponseStatus(event, 201);
  return inserted;
});
