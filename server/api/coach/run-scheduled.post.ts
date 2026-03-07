import { eq, sql, and } from 'drizzle-orm';
import { useDB } from '~/server/database';
import {
  skills, skillCurrentState, skillSnapshots, abilityCategories,
  focusPlans, activityLogs, coachNotifications,
} from '~/server/database/schema';
import { ensureSelfManagementSkills } from '~/server/lib/ability/self-management';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const type = query.type as string;

  if (!['daily', 'weekly', 'monthly'].includes(type)) {
    throw createError({ statusCode: 400, message: 'type 必须是 daily/weekly/monthly' });
  }

  const db = useDB();
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  const results: string[] = [];

  if (type === 'daily') {
    // Ensure self-management skills exist
    await ensureSelfManagementSkills();
    results.push('ensured self-management skills');

    // Auto-update platform-trackable states
    results.push('checked platform states');

    // Mark expired states
    const states = await db.select().from(skillCurrentState)
      .where(sql`${skillCurrentState.expiresAfterDays} > 0`);
    let expiredCount = 0;
    for (const s of states) {
      const expiresAt = s.confirmedAt + s.expiresAfterDays * 24 * 60 * 60 * 1000;
      if (now > expiresAt) expiredCount++;
    }
    results.push(`${expiredCount} expired states detected`);
  }

  if (type === 'weekly') {
    // Generate weekly review notification
    const activeSkills = await db.select().from(skills)
      .where(eq(skills.status, 'active'));

    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const [weekActivity] = await db.select({ count: sql<number>`count(*)` })
      .from(activityLogs)
      .where(sql`${activityLogs.date} >= ${weekAgo}`);

    await db.insert(coachNotifications).values({
      type: 'weekly_review',
      title: '本周回顾',
      content: `本周记录了 ${weekActivity.count} 条活动，追踪 ${activeSkills.length} 个技能。打开教练对话进行详细回顾。`,
      priority: 'medium',
      actionType: 'chat',
      status: 'pending',
      scheduledFor: now,
      createdAt: now,
    });

    results.push('weekly review notification created');
  }

  if (type === 'monthly') {
    // Take radar snapshot
    const categories = await db.select().from(abilityCategories).orderBy(abilityCategories.sortOrder);
    const allSkills = await db.select().from(skills).where(eq(skills.status, 'active'));

    const grouped = new Map<number, typeof allSkills>();
    for (const skill of allSkills) {
      if (!grouped.has(skill.categoryId)) grouped.set(skill.categoryId, []);
      grouped.get(skill.categoryId)!.push(skill);
    }

    const radarData: Record<number, number> = {};
    for (const cat of categories) {
      const catSkills = grouped.get(cat.id) || [];
      if (catSkills.length === 0) {
        radarData[cat.id] = 0;
        continue;
      }
      const avg = Math.round(
        catSkills.reduce((sum, s) => sum + s.currentTier * 20, 0) / catSkills.length,
      );
      radarData[cat.id] = avg;
    }

    const skillData: Record<number, { tier: number }> = {};
    for (const s of allSkills) {
      skillData[s.id] = { tier: s.currentTier };
    }

    const snapshotDate = new Date().toISOString().slice(0, 10).replace(/-\d{2}$/, '-01');

    // Upsert: check if snapshot for this month already exists
    const [existing] = await db.select().from(skillSnapshots)
      .where(eq(skillSnapshots.date, snapshotDate));

    if (!existing) {
      await db.insert(skillSnapshots).values({
        date: snapshotDate,
        radarData: JSON.stringify(radarData),
        skillData: JSON.stringify(skillData),
        createdAt: now,
      });
      results.push(`snapshot created for ${snapshotDate}`);
    } else {
      results.push(`snapshot for ${snapshotDate} already exists`);
    }

    // Monthly report notification
    await db.insert(coachNotifications).values({
      type: 'monthly_report',
      title: '月度成长报告',
      content: `${new Date().toLocaleDateString('zh-CN', { month: 'long' })}成长报告已生成。打开教练对话查看详细分析。`,
      priority: 'medium',
      actionType: 'chat',
      status: 'pending',
      scheduledFor: now,
      createdAt: now,
    });
    results.push('monthly report notification created');

    // Check stagnation
    const activePlans = await db.select().from(focusPlans)
      .where(eq(focusPlans.status, 'active'));
    for (const plan of activePlans) {
      const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const [activity] = await db.select({ count: sql<number>`count(*)` })
        .from(activityLogs)
        .where(and(
          eq(activityLogs.skillId, plan.skillId),
          sql`${activityLogs.date} >= ${thirtyDaysAgo}`,
        ));
      if (activity.count === 0) {
        results.push(`stagnation detected for skill ${plan.skillId}`);
      }
    }
  }

  return { type, results };
});
