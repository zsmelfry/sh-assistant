import { eq, sql } from 'drizzle-orm';
import { useDB } from '~/server/database';
import {
  plannerDomains, plannerGoals, plannerGoalTags,
} from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const sourceYear = Number(body.sourceYear);
  const targetYear = Number(body.targetYear);

  if (!sourceYear || !targetYear || sourceYear === targetYear) {
    throw createError({ statusCode: 400, message: '需要不同的源年份和目标年份' });
  }

  const db = useDB();

  // Check target year has no domains
  const existing = await db
    .select({ count: sql<number>`count(*)` })
    .from(plannerDomains)
    .where(eq(plannerDomains.year, targetYear));

  if (existing[0].count > 0) {
    throw createError({ statusCode: 409, message: `${targetYear} 年已有数据，无法复制` });
  }

  // Get source domains
  const sourceDomains = await db
    .select()
    .from(plannerDomains)
    .where(eq(plannerDomains.year, sourceYear))
    .orderBy(plannerDomains.sortOrder);

  if (sourceDomains.length === 0) {
    throw createError({ statusCode: 404, message: `${sourceYear} 年没有数据可复制` });
  }

  const now = Date.now();
  let domainsCopied = 0;
  let goalsCopied = 0;

  for (const domain of sourceDomains) {
    const [newDomain] = await db.insert(plannerDomains).values({
      name: domain.name,
      year: targetYear,
      sortOrder: domain.sortOrder,
      createdAt: now,
      updatedAt: now,
    }).returning();

    domainsCopied++;

    const sourceGoals = await db
      .select()
      .from(plannerGoals)
      .where(eq(plannerGoals.domainId, domain.id))
      .orderBy(plannerGoals.sortOrder);

    for (const goal of sourceGoals) {
      const [newGoal] = await db.insert(plannerGoals).values({
        domainId: newDomain.id,
        title: goal.title,
        description: goal.description,
        priority: goal.priority,
        sortOrder: goal.sortOrder,
        createdAt: now,
        updatedAt: now,
      }).returning();

      goalsCopied++;

      const goalTags = await db
        .select()
        .from(plannerGoalTags)
        .where(eq(plannerGoalTags.goalId, goal.id));

      for (const gt of goalTags) {
        await db.insert(plannerGoalTags).values({
          goalId: newGoal.id,
          tagId: gt.tagId,
        });
      }
    }
  }

  setResponseStatus(event, 201);
  return { domainsCopied, goalsCopied };
});
