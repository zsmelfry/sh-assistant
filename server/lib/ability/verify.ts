import { eq, sql, and } from 'drizzle-orm';
import { useDB } from '~/server/database';
import {
  vocabProgress,
  checkins,
  habits,
  plannerGoals,
  plannerCheckitems,
  smPoints,
  smDomains,
} from '~/server/database/schema';

export interface VerifyResult {
  passed: boolean;
  score?: number;
  detail?: string;
}

interface VerifyConfig {
  source: string;
  metric: string;
  threshold: number;
  skillId?: string; // for skill_learning source, to scope by skillId
}

/**
 * Execute platform_auto verification by querying real platform data.
 */
export async function verifyPlatformAuto(config: VerifyConfig): Promise<VerifyResult> {
  const db = useDB();
  const { source, metric, threshold } = config;

  if (source === 'vocab') {
    return verifyVocab(db, metric, threshold);
  }
  if (source === 'habit') {
    return verifyHabit(db, metric, threshold);
  }
  if (source === 'planner') {
    return verifyPlanner(db, metric, threshold);
  }
  if (source === 'skill_learning') {
    return verifySkillLearning(db, metric, threshold, config.skillId);
  }

  return { passed: false, detail: `unsupported source: ${source}` };
}

/**
 * Stub for platform_test verification (e.g., vocab quiz).
 */
export async function verifyPlatformTest(_config: VerifyConfig): Promise<VerifyResult> {
  return { passed: false, detail: 'test generation not yet implemented' };
}

// ── Vocab ──────────────────────────────────────────────

async function verifyVocab(db: ReturnType<typeof useDB>, metric: string, threshold: number): Promise<VerifyResult> {
  if (metric === 'mastered_count') {
    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(vocabProgress)
      .where(eq(vocabProgress.isMastered, true));
    const score = row.count;
    return {
      passed: score >= threshold,
      score,
      detail: `已掌握词汇：${score}/${threshold}`,
    };
  }

  return { passed: false, detail: `unsupported metric: ${metric}` };
}

// ── Habit ──────────────────────────────────────────────

async function verifyHabit(db: ReturnType<typeof useDB>, metric: string, threshold: number): Promise<VerifyResult> {
  if (metric === 'any_streak_days' || metric === 'max_streak_days') {
    const maxStreak = await calcMaxStreakDays(db);
    return {
      passed: maxStreak >= threshold,
      score: maxStreak,
      detail: `最长连续打卡：${maxStreak}天/${threshold}天`,
    };
  }

  if (metric === 'concurrent_habits_30d' || metric === 'concurrent_habits_90d') {
    const days = metric === 'concurrent_habits_30d' ? 30 : 90;
    const count = await countHabitsWithStreak(db, days);
    return {
      passed: count >= threshold,
      score: count,
      detail: `连续${days}天以上的习惯数：${count}/${threshold}`,
    };
  }

  return { passed: false, detail: `unsupported metric: ${metric}` };
}

/**
 * Calculate the max consecutive streak days across all habits.
 * A streak is consecutive dates with checkins for a single habit.
 */
async function calcMaxStreakDays(db: ReturnType<typeof useDB>): Promise<number> {
  // Get all checkins grouped by habit, ordered by date
  const allCheckins = await db
    .select({ habitId: checkins.habitId, date: checkins.date })
    .from(checkins)
    .innerJoin(habits, eq(habits.id, checkins.habitId))
    .where(eq(habits.archived, false))
    .orderBy(checkins.habitId, checkins.date);

  let maxStreak = 0;
  let currentHabitId = '';
  let currentStreak = 0;
  let prevDate = '';

  for (const row of allCheckins) {
    if (row.habitId !== currentHabitId) {
      currentHabitId = row.habitId;
      currentStreak = 1;
      prevDate = row.date;
      maxStreak = Math.max(maxStreak, currentStreak);
      continue;
    }

    // Check if consecutive day
    const prev = new Date(prevDate);
    const curr = new Date(row.date);
    const diffMs = curr.getTime() - prev.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      currentStreak++;
    } else if (diffDays > 1) {
      currentStreak = 1;
    }
    // diffDays === 0 means duplicate, skip

    prevDate = row.date;
    maxStreak = Math.max(maxStreak, currentStreak);
  }

  return maxStreak;
}

/**
 * Count habits that have a current streak >= the given threshold days.
 */
async function countHabitsWithStreak(db: ReturnType<typeof useDB>, thresholdDays: number): Promise<number> {
  // Get all active habits
  const activeHabits = await db
    .select({ id: habits.id })
    .from(habits)
    .where(eq(habits.archived, false));

  let count = 0;

  for (const habit of activeHabits) {
    const habitCheckins = await db
      .select({ date: checkins.date })
      .from(checkins)
      .where(eq(checkins.habitId, habit.id))
      .orderBy(sql`${checkins.date} DESC`);

    if (habitCheckins.length === 0) continue;

    // Calculate current streak backwards from the most recent checkin
    let streak = 1;
    for (let i = 1; i < habitCheckins.length; i++) {
      const curr = new Date(habitCheckins[i - 1].date);
      const prev = new Date(habitCheckins[i].date);
      const diffMs = curr.getTime() - prev.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        streak++;
      } else {
        break;
      }
    }

    if (streak >= thresholdDays) {
      count++;
    }
  }

  return count;
}

// ── Planner ────────────────────────────────────────────

async function verifyPlanner(db: ReturnType<typeof useDB>, metric: string, threshold: number): Promise<VerifyResult> {
  if (metric === 'goal_count') {
    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(plannerGoals);
    const score = row.count;
    return {
      passed: score >= threshold,
      score,
      detail: `目标数：${score}/${threshold}`,
    };
  }

  if (metric === 'completed_checkitems') {
    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(plannerCheckitems)
      .where(sql`${plannerCheckitems.completedAt} IS NOT NULL`);
    const score = row.count;
    return {
      passed: score >= threshold,
      score,
      detail: `已完成检查项：${score}/${threshold}`,
    };
  }

  if (metric === 'completion_rate') {
    const [total] = await db
      .select({ count: sql<number>`count(*)` })
      .from(plannerCheckitems);
    const [completed] = await db
      .select({ count: sql<number>`count(*)` })
      .from(plannerCheckitems)
      .where(sql`${plannerCheckitems.completedAt} IS NOT NULL`);

    const rate = total.count > 0 ? Math.round((completed.count / total.count) * 100) : 0;
    return {
      passed: rate >= threshold,
      score: rate,
      detail: `完成率：${rate}%/${threshold}%`,
    };
  }

  return { passed: false, detail: `unsupported metric: ${metric}` };
}

// ── Skill Learning ─────────────────────────────────────

async function verifySkillLearning(
  db: ReturnType<typeof useDB>,
  metric: string,
  threshold: number,
  skillId?: string,
): Promise<VerifyResult> {
  if (metric === 'total_understood') {
    // Count smPoints where status is 'understood' or 'practiced'
    // Optionally scoped by skillId via smDomains
    let query;
    if (skillId) {
      const [row] = await db
        .select({ count: sql<number>`count(*)` })
        .from(smPoints)
        .innerJoin(
          smDomains,
          sql`${smPoints.topicId} IN (
            SELECT ${sql.raw('id')} FROM sm_topics WHERE domain_id IN (
              SELECT id FROM sm_domains WHERE skill_id = ${skillId}
            )
          )`,
        )
        .where(sql`${smPoints.status} IN ('understood', 'practiced')`);
      const score = row.count;
      return {
        passed: score >= threshold,
        score,
        detail: `已理解知识点：${score}/${threshold}`,
      };
    } else {
      const [row] = await db
        .select({ count: sql<number>`count(*)` })
        .from(smPoints)
        .where(sql`${smPoints.status} IN ('understood', 'practiced')`);
      const score = row.count;
      return {
        passed: score >= threshold,
        score,
        detail: `已理解知识点：${score}/${threshold}`,
      };
    }
  }

  return { passed: false, detail: `unsupported metric: ${metric}` };
}
