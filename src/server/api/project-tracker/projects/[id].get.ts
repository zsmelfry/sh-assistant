import { eq, sql } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { ptProjects, ptCategories, ptProjectTags, ptTags, ptChecklistItems, ptNotes, ptDiagrams } from '~/server/database/schema';
import { requireNumericParam } from '~/server/utils/handler-helpers';

export default defineEventHandler(async (event) => {
  const id = requireNumericParam(event, 'id', '事项');
  const db = useDB(event);

  const [project] = await db
    .select({
      id: ptProjects.id,
      title: ptProjects.title,
      description: ptProjects.description,
      status: ptProjects.status,
      categoryId: ptProjects.categoryId,
      dueDate: ptProjects.dueDate,
      priority: ptProjects.priority,
      blockedReason: ptProjects.blockedReason,
      archived: ptProjects.archived,
      sortOrder: ptProjects.sortOrder,
      createdAt: ptProjects.createdAt,
      updatedAt: ptProjects.updatedAt,
      categoryName: ptCategories.name,
    })
    .from(ptProjects)
    .leftJoin(ptCategories, eq(ptProjects.categoryId, ptCategories.id))
    .where(eq(ptProjects.id, id))
    .limit(1);

  if (!project) {
    throw createError({ statusCode: 404, message: '事项不存在' });
  }

  const tags = await db
    .select({ id: ptTags.id, name: ptTags.name, createdAt: ptTags.createdAt })
    .from(ptProjectTags)
    .innerJoin(ptTags, eq(ptProjectTags.tagId, ptTags.id))
    .where(eq(ptProjectTags.projectId, id));

  const [checklistStats] = await db
    .select({
      total: sql<number>`count(*)`,
      done: sql<number>`sum(case when ${ptChecklistItems.isCompleted} = 1 then 1 else 0 end)`,
    })
    .from(ptChecklistItems)
    .where(eq(ptChecklistItems.projectId, id));

  const [noteStats] = await db
    .select({ count: sql<number>`count(*)` })
    .from(ptNotes)
    .where(eq(ptNotes.projectId, id));

  const [diagramStats] = await db
    .select({ count: sql<number>`count(*)` })
    .from(ptDiagrams)
    .where(eq(ptDiagrams.projectId, id));

  return {
    ...project,
    tags,
    checklistTotal: checklistStats.total ?? 0,
    checklistDone: checklistStats.done ?? 0,
    noteCount: noteStats.count ?? 0,
    diagramCount: diagramStats.count ?? 0,
  };
});
