import { and, eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { checkins, habits, skills } from '~/server/database/schema';
import { isValidDate } from '~/server/utils/date';
import { logActivity } from '~/server/lib/ability/log-activity';

export default defineEventHandler(async (event) => {
  const { habitId, date } = await readBody(event);

  if (!habitId || !date) {
    throw createError({ statusCode: 400, message: '缺少 habitId 或 date' });
  }

  // M1: 校验日期格式 + Date parse 回验（拒绝 2026-02-30 等无效日期）
  if (!isValidDate(date)) {
    throw createError({ statusCode: 400, message: '日期无效，应为合法的 YYYY-MM-DD' });
  }

  // 不允许未来日期
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (new Date(date) > today) {
    throw createError({ statusCode: 400, message: '不能为未来日期打卡' });
  }

  const db = useDB();

  // M2: 校验 habit 存在性，避免 FK 约束报 500
  const habitRows = await db.select({ id: habits.id })
    .from(habits)
    .where(eq(habits.id, habitId))
    .limit(1);

  if (habitRows.length === 0) {
    throw createError({ statusCode: 404, message: '习惯不存在' });
  }

  const existing = await db.select()
    .from(checkins)
    .where(and(eq(checkins.habitId, habitId), eq(checkins.date, date)))
    .limit(1);

  if (existing.length > 0) {
    await db.delete(checkins)
      .where(and(eq(checkins.habitId, habitId), eq(checkins.date, date)));
    return { checked: false };
  } else {
    const newCheckin = {
      id: crypto.randomUUID(),
      habitId,
      date,
      createdAt: Date.now(),
    };
    await db.insert(checkins).values(newCheckin);

    // Log activity for ability system (fire-and-forget)
    const [habit] = await db.select({ name: habits.name, linkedAbilitySkillId: habits.linkedAbilitySkillId })
      .from(habits).where(eq(habits.id, habitId));

    const activityParams: Parameters<typeof logActivity>[0] = {
      source: 'habit',
      sourceRef: habitId,
      description: `习惯打卡：${habit?.name ?? habitId}`,
      date,
    };

    if (habit?.linkedAbilitySkillId) {
      const [skill] = await db.select({ id: skills.id, categoryId: skills.categoryId })
        .from(skills).where(eq(skills.id, habit.linkedAbilitySkillId)).limit(1);
      if (skill) {
        activityParams.skillId = skill.id;
        activityParams.categoryId = skill.categoryId;
      }
    }

    logActivity(activityParams).catch(() => {});

    return { checked: true, checkin: newCheckin };
  }
});
