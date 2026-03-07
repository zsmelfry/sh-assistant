import { eq, and, lte, sql, desc } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { coachNotifications, focusPlans, skills, skillCurrentState, activityLogs } from '~/server/database/schema';

export default defineEventHandler(async () => {
  const db = useDB();
  const now = Date.now();
  const notifications = [];

  // 1. Unread scheduled notifications that are due
  const scheduled = await db.select().from(coachNotifications)
    .where(and(
      eq(coachNotifications.status, 'pending'),
      lte(coachNotifications.scheduledFor, now),
    ))
    .orderBy(desc(coachNotifications.priority));
  notifications.push(...scheduled);

  // 2. Check focus skills with no activity in 7 days
  const activePlans = await db.select({
    skillId: focusPlans.skillId,
    skillName: skills.name,
  }).from(focusPlans)
    .leftJoin(skills, eq(skills.id, focusPlans.skillId))
    .where(eq(focusPlans.status, 'active'));

  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  for (const plan of activePlans) {
    const [recentActivity] = await db.select({ count: sql<number>`count(*)` })
      .from(activityLogs)
      .where(and(
        eq(activityLogs.skillId, plan.skillId),
        sql`${activityLogs.date} >= ${sevenDaysAgo}`,
      ));

    if (recentActivity.count === 0) {
      notifications.push({
        id: -plan.skillId, // virtual notification
        type: 'stagnation',
        title: '焦点技能停滞提醒',
        content: `「${plan.skillName}」已超过 7 天没有活动，是否需要调整计划？`,
        priority: 'medium',
        skillId: plan.skillId,
        actionType: 'view_skill',
        status: 'pending',
        scheduledFor: now,
        createdAt: now,
      });
    }
  }

  // 3. Check expiring states
  const expiringStates = await db.select({
    skillId: skillCurrentState.skillId,
    skillName: skills.name,
    stateLabel: skillCurrentState.stateLabel,
    confirmedAt: skillCurrentState.confirmedAt,
    expiresAfterDays: skillCurrentState.expiresAfterDays,
  }).from(skillCurrentState)
    .leftJoin(skills, eq(skills.id, skillCurrentState.skillId))
    .where(sql`${skillCurrentState.expiresAfterDays} > 0`);

  for (const state of expiringStates) {
    const expiresAt = state.confirmedAt + state.expiresAfterDays * 24 * 60 * 60 * 1000;
    const daysUntilExpiry = Math.ceil((expiresAt - now) / (24 * 60 * 60 * 1000));

    if (daysUntilExpiry <= 7 && daysUntilExpiry > 0) {
      notifications.push({
        id: -(state.skillId * 1000 + 1),
        type: 'state_expiring',
        title: '状态即将过期',
        content: `「${state.skillName}」的「${state.stateLabel}」将在 ${daysUntilExpiry} 天后过期，请确认更新`,
        priority: 'low',
        skillId: state.skillId,
        actionType: 'confirm_state',
        status: 'pending',
        scheduledFor: now,
        createdAt: now,
      });
    }
  }

  // Apply notification budget: max 1 high + 2 medium/low
  return applyNotificationBudget(notifications);
});

function applyNotificationBudget(notifications: any[]) {
  const priorityWeight = (p: string) => p === 'high' ? 3 : p === 'medium' ? 2 : 1;
  const sorted = notifications.sort((a, b) => priorityWeight(b.priority) - priorityWeight(a.priority));

  const high = sorted.filter((n) => n.priority === 'high').slice(0, 1);
  const rest = sorted.filter((n) => n.priority !== 'high').slice(0, 2);

  return [...high, ...rest];
}
