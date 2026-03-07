import { eq, sql } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { skills, milestones, milestoneCompletions, abilityCategories } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const db = useDB();

  const conditions = [];
  if (query.status) {
    conditions.push(eq(skills.status, query.status as string));
  }
  if (query.categoryId) {
    conditions.push(eq(skills.categoryId, Number(query.categoryId)));
  }

  const rows = await db
    .select({
      id: skills.id,
      categoryId: skills.categoryId,
      categoryName: abilityCategories.name,
      name: skills.name,
      description: skills.description,
      icon: skills.icon,
      source: skills.source,
      templateId: skills.templateId,
      currentTier: skills.currentTier,
      status: skills.status,
      sortOrder: skills.sortOrder,
      createdAt: skills.createdAt,
      updatedAt: skills.updatedAt,
      totalMilestones: sql<number>`count(distinct ${milestones.id})`,
      completedMilestones: sql<number>`count(distinct ${milestoneCompletions.id})`,
    })
    .from(skills)
    .leftJoin(abilityCategories, eq(abilityCategories.id, skills.categoryId))
    .leftJoin(milestones, eq(milestones.skillId, skills.id))
    .leftJoin(milestoneCompletions, eq(milestoneCompletions.milestoneId, milestones.id))
    .where(conditions.length > 0 ? sql`${sql.join(conditions, sql` AND `)}` : undefined)
    .groupBy(skills.id)
    .orderBy(skills.sortOrder, skills.createdAt);

  return rows;
});
