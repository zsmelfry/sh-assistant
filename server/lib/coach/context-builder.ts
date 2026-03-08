import { eq, sql, desc, and, gte, lte, count, isNotNull } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import {
  habits, checkins,
  plannerDomains, plannerGoals, plannerCheckitems,
  vocabWords, vocabProgress, LEARNING_STATUS,
  srsCards,
  skills, milestones, milestoneCompletions, abilityCategories, skillCurrentState, activityLogs,
  articles, articleBookmarks,
  ptProjects, ptChecklistItems,
} from '~/server/database/schema';

// ── Summary types ──

export interface HabitSummary {
  activeHabits: Array<{ id: string; name: string; frequency: string; todayDone: boolean; streak: number }>;
  totalActive: number;
  todayCompleted: number;
  longestStreak: number;
}

export interface PlannerSummary {
  year: number;
  totalDomains: number;
  totalGoals: number;
  totalCheckitems: number;
  completedCheckitems: number;
  completionRate: number;
  overdueCheckitems: number;
}

export interface VocabSummary {
  totalWords: number;
  mastered: number;
  learning: number;
  unread: number;
  pendingReviews: number;
}

export interface SkillLearningSummary {
  activeSkillLearnings: Array<{ name: string; progressPercent: number }>;
  recentActivity: string | null;
}

export interface AbilitySummary {
  skills: Array<{ name: string; tier: number; tierName: string; categoryName: string }>;
  radarScores: Array<{ categoryName: string; score: number }>;
  totalMilestones: number;
  completedMilestones: number;
}

export interface ArticleSummary {
  totalArticles: number;
  totalBookmarks: number;
  recentArticles: Array<{ title: string; readAt: number | null }>;
}

export interface ProjectSummary {
  activeProjects: number;
  overdueItems: number;
  recentProjects: Array<{ title: string; status: string }>;
}

export interface GlobalContext {
  habits: HabitSummary | null;
  planner: PlannerSummary | null;
  vocab: VocabSummary | null;
  skillLearning: SkillLearningSummary | null;
  ability: AbilitySummary | null;
  articles: ArticleSummary | null;
  projects: ProjectSummary | null;
}

// ── Tier names ──

const TIER_NAMES: Record<number, string> = {
  0: '未开始', 1: '入门', 2: '基础', 3: '胜任', 4: '精通', 5: '卓越',
};

// ── Keyword → data source mapping ──

const CONTEXT_RULES: Array<{ pattern: RegExp; sources: (keyof GlobalContext)[] }> = [
  { pattern: /习惯|打卡|坚持|连续|streak|日常/, sources: ['habits'] },
  { pattern: /计划|目标|进度|完成率|年度/, sources: ['planner'] },
  { pattern: /法语|词汇|单词|复习|SRS|背单词|vocab/, sources: ['vocab'] },
  { pattern: /学习|知识|课程|教程|skill.?learn/, sources: ['skillLearning'] },
  { pattern: /能力|技能|等级|段位|雷达|里程碑|成长|tier/, sources: ['ability'] },
  { pattern: /文章|阅读|书签|article/, sources: ['articles'] },
  { pattern: /项目|事项|任务|project/, sources: ['projects'] },
  { pattern: /整体|全面|总结|回顾|情况|状态|所有/, sources: ['habits', 'planner', 'vocab', 'skillLearning', 'ability', 'articles', 'projects'] },
];

const DEFAULT_SOURCES: (keyof GlobalContext)[] = ['habits', 'ability'];

// ── Public API ──

export async function collectRelevantContext(
  db: BetterSQLite3Database<any>,
  userMessage: string,
): Promise<Partial<GlobalContext>> {
  const needed = new Set<keyof GlobalContext>();

  for (const rule of CONTEXT_RULES) {
    if (rule.pattern.test(userMessage)) {
      for (const s of rule.sources) needed.add(s);
    }
  }

  if (needed.size === 0) {
    for (const s of DEFAULT_SOURCES) needed.add(s);
  }

  const result: Partial<GlobalContext> = {};
  const collectors: Array<Promise<void>> = [];

  if (needed.has('habits')) collectors.push(collectHabitContext(db).then(v => { result.habits = v; }));
  if (needed.has('planner')) collectors.push(collectPlannerContext(db).then(v => { result.planner = v; }));
  if (needed.has('vocab')) collectors.push(collectVocabContext(db).then(v => { result.vocab = v; }));
  if (needed.has('skillLearning')) collectors.push(collectSkillLearningContext(db).then(v => { result.skillLearning = v; }));
  if (needed.has('ability')) collectors.push(collectAbilityContext(db).then(v => { result.ability = v; }));
  if (needed.has('articles')) collectors.push(collectArticleContext(db).then(v => { result.articles = v; }));
  if (needed.has('projects')) collectors.push(collectProjectContext(db).then(v => { result.projects = v; }));

  await Promise.all(collectors);
  return result;
}

export async function collectFullSummary(db: BetterSQLite3Database<any>): Promise<GlobalContext> {
  const [h, p, v, sl, a, ar, pr] = await Promise.all([
    collectHabitContext(db),
    collectPlannerContext(db),
    collectVocabContext(db),
    collectSkillLearningContext(db),
    collectAbilityContext(db),
    collectArticleContext(db),
    collectProjectContext(db),
  ]);
  return { habits: h, planner: p, vocab: v, skillLearning: sl, ability: a, articles: ar, projects: pr };
}

// ── Formatters (context → text for prompt) ──

export function formatContextForPrompt(ctx: Partial<GlobalContext>): string {
  const parts: string[] = [];

  if (ctx.habits) {
    const h = ctx.habits;
    parts.push(`### 习惯打卡`);
    parts.push(`活跃习惯 ${h.totalActive} 个，今日已完成 ${h.todayCompleted}/${h.totalActive}`);
    if (h.longestStreak > 0) parts.push(`最长连续: ${h.longestStreak} 天`);
    for (const hab of h.activeHabits) {
      parts.push(`- ${hab.name}(${hab.frequency}): ${hab.todayDone ? '✓已完成' : '✗未完成'}, 连续${hab.streak}天`);
    }
  }

  if (ctx.planner) {
    const p = ctx.planner;
    parts.push(`### 年度计划 (${p.year})`);
    parts.push(`${p.totalDomains}个领域, ${p.totalGoals}个目标, 检查项完成率 ${p.completionRate}% (${p.completedCheckitems}/${p.totalCheckitems})`);
    if (p.overdueCheckitems > 0) parts.push(`⚠ ${p.overdueCheckitems} 个检查项已逾期`);
  }

  if (ctx.vocab) {
    const v = ctx.vocab;
    parts.push(`### 法语词汇`);
    parts.push(`总词汇 ${v.totalWords}, 已掌握 ${v.mastered}, 学习中 ${v.learning}, 未学 ${v.unread}`);
    if (v.pendingReviews > 0) parts.push(`待复习: ${v.pendingReviews} 个`);
  }

  if (ctx.skillLearning) {
    const sl = ctx.skillLearning;
    if (sl.activeSkillLearnings.length > 0) {
      parts.push(`### 技能学习`);
      for (const s of sl.activeSkillLearnings) {
        parts.push(`- ${s.name}: 进度 ${s.progressPercent}%`);
      }
    }
  }

  if (ctx.ability) {
    const a = ctx.ability;
    parts.push(`### 能力画像`);
    if (a.skills.length > 0) {
      parts.push(`技能列表:`);
      for (const s of a.skills) {
        parts.push(`- ${s.name}(${s.categoryName}): ${s.tierName}(${s.tier}级)`);
      }
    }
    parts.push(`里程碑进度: ${a.completedMilestones}/${a.totalMilestones}`);
    if (a.radarScores.length > 0) {
      parts.push(`雷达图: ${a.radarScores.map(r => `${r.categoryName}=${r.score}`).join(', ')}`);
    }
  }

  if (ctx.articles) {
    const ar = ctx.articles;
    parts.push(`### 文章阅读`);
    parts.push(`共 ${ar.totalArticles} 篇, 收藏 ${ar.totalBookmarks} 篇`);
  }

  if (ctx.projects) {
    const pr = ctx.projects;
    parts.push(`### 事项追踪`);
    parts.push(`活跃项目 ${pr.activeProjects} 个`);
    if (pr.overdueItems > 0) parts.push(`⚠ ${pr.overdueItems} 个事项已逾期`);
  }

  return parts.length > 0 ? `\n\n## 用户当前数据\n${parts.join('\n')}` : '';
}

// ── Collectors ──

async function collectHabitContext(db: BetterSQLite3Database<any>): Promise<HabitSummary> {
  const today = new Date().toISOString().slice(0, 10);

  const activeHabits = await db.select({
    id: habits.id,
    name: habits.name,
    frequency: habits.frequency,
  }).from(habits).where(eq(habits.archived, false));

  if (activeHabits.length === 0) {
    return { activeHabits: [], totalActive: 0, todayCompleted: 0, longestStreak: 0 };
  }

  // Get today's checkins
  const todayCheckins = await db.select({ habitId: checkins.habitId })
    .from(checkins)
    .where(eq(checkins.date, today));
  const todaySet = new Set(todayCheckins.map(c => c.habitId));

  // Compute streaks: for each habit get all dates ordered desc, count consecutive from today
  const result: HabitSummary['activeHabits'] = [];
  let longestStreak = 0;

  for (const habit of activeHabits) {
    const dates = await db.select({ date: checkins.date })
      .from(checkins)
      .where(eq(checkins.habitId, habit.id))
      .orderBy(desc(checkins.date));

    let streak = 0;
    if (dates.length > 0) {
      const dateSet = new Set(dates.map(d => d.date));
      const d = new Date(today);
      // If not done today, check from yesterday
      if (!dateSet.has(today)) d.setDate(d.getDate() - 1);
      while (dateSet.has(d.toISOString().slice(0, 10))) {
        streak++;
        d.setDate(d.getDate() - 1);
      }
    }

    if (streak > longestStreak) longestStreak = streak;

    result.push({
      id: habit.id,
      name: habit.name,
      frequency: habit.frequency,
      todayDone: todaySet.has(habit.id),
      streak,
    });
  }

  return {
    activeHabits: result,
    totalActive: activeHabits.length,
    todayCompleted: todaySet.size,
    longestStreak,
  };
}

async function collectPlannerContext(db: BetterSQLite3Database<any>): Promise<PlannerSummary> {
  const year = new Date().getFullYear();
  const today = new Date().toISOString().slice(0, 10);

  const domainRows = await db
    .select({
      goalCount: sql<number>`count(distinct ${plannerGoals.id})`,
      totalCheckitems: sql<number>`count(distinct ${plannerCheckitems.id})`,
      completedCheckitems: sql<number>`count(distinct case when ${plannerCheckitems.isCompleted} = 1 then ${plannerCheckitems.id} end)`,
    })
    .from(plannerDomains)
    .leftJoin(plannerGoals, eq(plannerGoals.domainId, plannerDomains.id))
    .leftJoin(plannerCheckitems, eq(plannerCheckitems.goalId, plannerGoals.id))
    .where(eq(plannerDomains.year, year));

  const totalDomains = await db.select({ count: count() }).from(plannerDomains).where(eq(plannerDomains.year, year));

  const row = domainRows[0] || { goalCount: 0, totalCheckitems: 0, completedCheckitems: 0 };
  const completionRate = row.totalCheckitems > 0
    ? Math.round((row.completedCheckitems / row.totalCheckitems) * 100)
    : 0;

  // Count overdue: uncompleted checkitems — we don't have dueDate on checkitems,
  // so we use goals' stagnation as a proxy (no activity for 14+ days)
  // For simplicity, report uncompleted count
  const overdueCheckitems = row.totalCheckitems - row.completedCheckitems;

  return {
    year,
    totalDomains: totalDomains[0]?.count || 0,
    totalGoals: row.goalCount,
    totalCheckitems: row.totalCheckitems,
    completedCheckitems: row.completedCheckitems,
    completionRate,
    overdueCheckitems: 0, // checkitems don't have due dates
  };
}

async function collectVocabContext(db: BetterSQLite3Database<any>): Promise<VocabSummary> {
  const [totalResult] = await db.select({ count: count() }).from(vocabWords);
  const total = totalResult?.count || 0;

  if (total === 0) {
    return { totalWords: 0, mastered: 0, learning: 0, unread: total, pendingReviews: 0 };
  }

  // Status counts
  const statusRows: Array<{ status: string; count: number }> = await db.all(sql`
    SELECT
      COALESCE(p.learning_status, ${LEARNING_STATUS.UNREAD}) as status,
      COUNT(*) as count
    FROM vocab_words w
    LEFT JOIN vocab_progress p ON w.id = p.word_id
    GROUP BY COALESCE(p.learning_status, ${LEARNING_STATUS.UNREAD})
  `) as any;

  const statusMap: Record<string, number> = {};
  for (const row of statusRows) {
    statusMap[row.status] = row.count;
  }

  // Pending SRS reviews
  const now = Date.now();
  const [pendingResult] = await db.select({ count: count() })
    .from(srsCards)
    .where(lte(srsCards.nextReviewAt, now));

  return {
    totalWords: total,
    mastered: statusMap[LEARNING_STATUS.MASTERED] || 0,
    learning: (statusMap[LEARNING_STATUS.LEARNING] || 0) + (statusMap[LEARNING_STATUS.TO_LEARN] || 0),
    unread: statusMap[LEARNING_STATUS.UNREAD] || 0,
    pendingReviews: pendingResult?.count || 0,
  };
}

async function collectSkillLearningContext(db: BetterSQLite3Database<any>): Promise<SkillLearningSummary> {
  // Skill learning uses sm_domains / sm_topics / sm_points tables with skillId isolation
  // These are from the startup-map schema. Query directly.
  const learnings: Array<{ name: string; progressPercent: number }> = [];

  try {
    const rows: Array<{ skillId: string; total: number; mastered: number }> = await db.all(sql`
      SELECT d.skill_id as skillId,
             COUNT(p.id) as total,
             SUM(CASE WHEN p.status = 'mastered' THEN 1 ELSE 0 END) as mastered
      FROM sm_domains d
      JOIN sm_topics t ON t.domain_id = d.id
      JOIN sm_points p ON p.topic_id = t.id
      GROUP BY d.skill_id
    `) as any;

    // Get skill config names
    const configRows: Array<{ id: string; name: string }> = await db.all(sql`
      SELECT id, name FROM skill_configs
    `) as any;
    const configMap = new Map(configRows.map(r => [r.id, r.name]));

    for (const row of rows) {
      const name = configMap.get(row.skillId) || row.skillId;
      const percent = row.total > 0 ? Math.round((row.mastered / row.total) * 100) : 0;
      learnings.push({ name, progressPercent: percent });
    }
  } catch {
    // Tables may not exist
  }

  // Recent activity
  const recentRows = await db.select({ description: activityLogs.description })
    .from(activityLogs)
    .where(eq(activityLogs.source, 'skill_learning'))
    .orderBy(desc(activityLogs.createdAt))
    .limit(1);

  return {
    activeSkillLearnings: learnings,
    recentActivity: recentRows[0]?.description || null,
  };
}

async function collectAbilityContext(db: BetterSQLite3Database<any>): Promise<AbilitySummary> {
  // Skills with category names
  const allSkills = await db.select({
    name: skills.name,
    tier: skills.currentTier,
    categoryName: abilityCategories.name,
  }).from(skills)
    .leftJoin(abilityCategories, eq(abilityCategories.id, skills.categoryId))
    .where(eq(skills.status, 'active'));

  // Radar scores
  const categories = await db.select().from(abilityCategories).orderBy(abilityCategories.sortOrder);
  const grouped = new Map<string, number[]>();
  for (const s of allSkills) {
    const cat = s.categoryName || '未知';
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(s.tier * 20);
  }
  const radarScores = categories
    .filter(c => grouped.has(c.name))
    .map(c => {
      const scores = grouped.get(c.name)!;
      return { categoryName: c.name, score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) };
    });

  // Milestone counts
  const [milestoneStats] = await db.select({
    total: sql<number>`count(distinct ${milestones.id})`,
    completed: sql<number>`count(distinct ${milestoneCompletions.id})`,
  }).from(milestones)
    .leftJoin(milestoneCompletions, eq(milestoneCompletions.milestoneId, milestones.id));

  return {
    skills: allSkills.map(s => ({
      name: s.name,
      tier: s.tier,
      tierName: TIER_NAMES[s.tier] || '未知',
      categoryName: s.categoryName || '未知',
    })),
    radarScores,
    totalMilestones: milestoneStats?.total || 0,
    completedMilestones: milestoneStats?.completed || 0,
  };
}

async function collectArticleContext(db: BetterSQLite3Database<any>): Promise<ArticleSummary> {
  const [totalResult] = await db.select({ count: count() }).from(articles);
  const [bookmarkResult] = await db.select({ count: count() }).from(articleBookmarks);

  const recentArticles = await db.select({
    title: articles.title,
    readAt: articles.lastReadAt,
  }).from(articles)
    .orderBy(desc(articles.createdAt))
    .limit(5);

  return {
    totalArticles: totalResult?.count || 0,
    totalBookmarks: bookmarkResult?.count || 0,
    recentArticles: recentArticles.map(a => ({ title: a.title, readAt: a.readAt })),
  };
}

async function collectProjectContext(db: BetterSQLite3Database<any>): Promise<ProjectSummary> {
  const today = new Date().toISOString().slice(0, 10);
  const activeStatuses = ['todo', 'in_progress', 'blocked'];

  const [activeResult] = await db.select({ count: count() })
    .from(ptProjects)
    .where(sql`${ptProjects.status} IN ('todo', 'in_progress', 'blocked') AND ${ptProjects.archived} = 0`);

  // Overdue checklist items
  const [overdueResult] = await db.select({ count: count() })
    .from(ptChecklistItems)
    .where(and(
      eq(ptChecklistItems.isCompleted, false),
      isNotNull(ptChecklistItems.dueDate),
      lte(ptChecklistItems.dueDate, today),
    ));

  const recentProjects = await db.select({
    title: ptProjects.title,
    status: ptProjects.status,
  }).from(ptProjects)
    .where(eq(ptProjects.archived, false))
    .orderBy(desc(ptProjects.updatedAt))
    .limit(5);

  return {
    activeProjects: activeResult?.count || 0,
    overdueItems: overdueResult?.count || 0,
    recentProjects: recentProjects.map(p => ({ title: p.title, status: p.status })),
  };
}
