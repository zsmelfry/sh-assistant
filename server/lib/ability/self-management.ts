import { eq, sql, and } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { skills, milestones, abilityCategories } from '~/server/database/schema';

interface SelfManagementSkillDef {
  name: string;
  milestones: Array<{
    tier: number;
    title: string;
    verify: string;
    config: Record<string, any>;
  }>;
}

const SELF_MANAGEMENT_SKILLS: SelfManagementSkillDef[] = [
  {
    name: '习惯坚持度',
    milestones: [
      { tier: 1, title: '创建第一个习惯并坚持7天', verify: 'platform_auto',
        config: { source: 'habit', metric: 'any_streak_days', threshold: 7 } },
      { tier: 2, title: '同时维持2个习惯各30天', verify: 'platform_auto',
        config: { source: 'habit', metric: 'concurrent_habits_30d', threshold: 2 } },
      { tier: 3, title: '任意习惯连续100天', verify: 'platform_auto',
        config: { source: 'habit', metric: 'max_streak_days', threshold: 100 } },
      { tier: 4, title: '同时维持3个习惯各90天', verify: 'platform_auto',
        config: { source: 'habit', metric: 'concurrent_habits_90d', threshold: 3 } },
      { tier: 5, title: '任意习惯连续365天', verify: 'platform_auto',
        config: { source: 'habit', metric: 'max_streak_days', threshold: 365 } },
    ],
  },
  {
    name: '目标执行力',
    milestones: [
      { tier: 1, title: '设定第一个年度目标', verify: 'platform_auto',
        config: { source: 'planner', metric: 'goal_count', threshold: 1 } },
      { tier: 2, title: '完成5个检查项', verify: 'platform_auto',
        config: { source: 'planner', metric: 'completed_checkitems', threshold: 5 } },
      { tier: 3, title: '年度计划完成率 > 50%', verify: 'platform_auto',
        config: { source: 'planner', metric: 'completion_rate', threshold: 0.5 } },
      { tier: 4, title: '年度计划完成率 > 80%', verify: 'platform_auto',
        config: { source: 'planner', metric: 'completion_rate', threshold: 0.8 } },
      { tier: 5, title: '连续2年完成率 > 80%', verify: 'platform_auto',
        config: { source: 'planner', metric: 'consecutive_years_80pct', threshold: 2 } },
    ],
  },
  {
    name: '学习持续性',
    milestones: [
      { tier: 1, title: '在技能学习中完成10个知识点', verify: 'platform_auto',
        config: { source: 'skill_learning', metric: 'total_understood', threshold: 10 } },
      { tier: 2, title: '连续4周每周有学习活动', verify: 'platform_auto',
        config: { source: 'skill_learning', metric: 'active_weeks_streak', threshold: 4 } },
      { tier: 3, title: '连续12周每周有学习活动', verify: 'platform_auto',
        config: { source: 'skill_learning', metric: 'active_weeks_streak', threshold: 12 } },
      { tier: 4, title: '完成一个技能学习模块全部知识点practiced', verify: 'platform_auto',
        config: { source: 'skill_learning', metric: 'any_skill_all_practiced', threshold: 1 } },
      { tier: 5, title: '3个技能学习模块全部practiced', verify: 'platform_auto',
        config: { source: 'skill_learning', metric: 'skills_all_practiced', threshold: 3 } },
    ],
  },
];

/**
 * Ensure self-management skills exist.
 * Called during daily scheduled task or on first dashboard load.
 * Creates the 3 auto skills under "自我管理" category if they don't exist.
 */
export async function ensureSelfManagementSkills() {
  const db = useDB();

  // Find the "自我管理" category
  const [category] = await db.select().from(abilityCategories)
    .where(eq(abilityCategories.name, '自我管理'));
  if (!category) return; // Categories not seeded yet

  const now = Date.now();

  for (const def of SELF_MANAGEMENT_SKILLS) {
    // Check if skill already exists
    const [existing] = await db.select().from(skills)
      .where(and(
        eq(skills.categoryId, category.id),
        eq(skills.name, def.name),
        eq(skills.source, 'system'),
      ));

    if (existing) continue;

    // Create skill
    const [maxRow] = await db
      .select({ max: sql<number>`coalesce(max(${skills.sortOrder}), -1)` })
      .from(skills);

    const [skill] = await db.insert(skills).values({
      categoryId: category.id,
      name: def.name,
      description: `由平台自动追踪`,
      source: 'system',
      currentTier: 0,
      status: 'active',
      sortOrder: maxRow.max + 1,
      createdAt: now,
      updatedAt: now,
    }).returning();

    // Create milestones
    if (def.milestones.length > 0) {
      await db.insert(milestones).values(
        def.milestones.map((m, idx) => ({
          skillId: skill.id,
          tier: m.tier,
          title: m.title,
          milestoneType: 'quantity' as const,
          verifyMethod: m.verify,
          verifyConfig: JSON.stringify(m.config),
          sortOrder: idx,
          createdAt: now,
          updatedAt: now,
        })),
      );
    }
  }
}
