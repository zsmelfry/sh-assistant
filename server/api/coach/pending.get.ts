import { eq, and, lte, sql, desc, count } from 'drizzle-orm';
import { useDB } from '~/server/database';
import {
  coachNotifications, focusPlans, skills, skillCurrentState, activityLogs,
  habits, checkins, srsCards, plannerDomains, plannerGoals, plannerCheckitems,
} from '~/server/database/schema';

export default defineEventHandler(async () => {
  const db = useDB();
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  const notifications: any[] = [];

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
        id: -plan.skillId,
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

  // 4. Habit streak at risk — active habits with streaks that haven't been done today (after 20:00)
  const hour = new Date().getHours();
  if (hour >= 20) {
    const activeHabits = await db.select({
      id: habits.id,
      name: habits.name,
    }).from(habits).where(eq(habits.archived, false));

    for (const habit of activeHabits) {
      // Check if done today
      const [todayCheckin] = await db.select({ id: checkins.id })
        .from(checkins)
        .where(and(eq(checkins.habitId, habit.id), eq(checkins.date, today)))
        .limit(1);

      if (todayCheckin) continue;

      // Check if has a streak (done yesterday)
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const [yesterdayCheckin] = await db.select({ id: checkins.id })
        .from(checkins)
        .where(and(eq(checkins.habitId, habit.id), eq(checkins.date, yesterday)))
        .limit(1);

      if (yesterdayCheckin) {
        notifications.push({
          id: -(10000 + parseInt(habit.id.replace(/\D/g, '').slice(0, 8) || '0', 10)),
          type: 'habit_streak_risk',
          title: '连续记录即将断裂',
          content: `「${habit.name}」今天还没打卡，别让连续记录断了`,
          priority: 'high',
          skillId: null,
          actionType: 'go_habit',
          actionUrl: '/habit-tracker',
          status: 'pending',
          scheduledFor: now,
          createdAt: now,
        });
      }
    }
  }

  // 5. SRS review backlog > 20
  const [pendingSrs] = await db.select({ count: count() })
    .from(srsCards)
    .where(lte(srsCards.nextReviewAt, now));

  if (pendingSrs.count > 20) {
    notifications.push({
      id: -99001,
      type: 'srs_backlog',
      title: '词汇复习积压',
      content: `有 ${pendingSrs.count} 个法语词汇待复习，建议今天处理一些`,
      priority: 'medium',
      skillId: null,
      actionType: 'go_vocab',
      actionUrl: '/vocab-tracker',
      status: 'pending',
      scheduledFor: now,
      createdAt: now,
    });
  }

  // 6. Planner overdue: incomplete checkitems from goals in current year
  const year = new Date().getFullYear();
  const [plannerStats] = await db
    .select({
      totalCheckitems: sql<number>`count(distinct ${plannerCheckitems.id})`,
      completedCheckitems: sql<number>`count(distinct case when ${plannerCheckitems.isCompleted} = 1 then ${plannerCheckitems.id} end)`,
    })
    .from(plannerDomains)
    .leftJoin(plannerGoals, eq(plannerGoals.domainId, plannerDomains.id))
    .leftJoin(plannerCheckitems, eq(plannerCheckitems.goalId, plannerGoals.id))
    .where(eq(plannerDomains.year, year));

  if (plannerStats) {
    const incomplete = plannerStats.totalCheckitems - plannerStats.completedCheckitems;
    const completionRate = plannerStats.totalCheckitems > 0
      ? Math.round((plannerStats.completedCheckitems / plannerStats.totalCheckitems) * 100)
      : 100;

    // Only warn if completion rate is low (< 30%) and there are items
    if (completionRate < 30 && incomplete > 5) {
      notifications.push({
        id: -99002,
        type: 'planner_behind',
        title: '年度计划进度落后',
        content: `${year} 年度计划完成率仅 ${completionRate}%，还有 ${incomplete} 项待完成`,
        priority: 'medium',
        skillId: null,
        actionType: 'go_planner',
        actionUrl: '/annual-planner',
        status: 'pending',
        scheduledFor: now,
        createdAt: now,
      });
    }
  }

  // Apply notification budget: max 1 high + 3 medium/low
  return applyNotificationBudget(notifications);
});

function applyNotificationBudget(notifications: any[]) {
  const priorityWeight = (p: string) => p === 'high' ? 3 : p === 'medium' ? 2 : 1;
  const sorted = notifications.sort((a, b) => priorityWeight(b.priority) - priorityWeight(a.priority));

  const high = sorted.filter((n) => n.priority === 'high').slice(0, 1);
  const rest = sorted.filter((n) => n.priority !== 'high').slice(0, 3);

  return [...high, ...rest];
}
