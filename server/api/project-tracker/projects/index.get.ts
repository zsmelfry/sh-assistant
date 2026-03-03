import { eq, and, like, or, sql, inArray } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { ptProjects, ptCategories, ptProjectTags, ptTags, ptChecklistItems, ptNotes, ptDiagrams } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const db = useDB();

  // Build WHERE conditions
  const conditions: any[] = [];

  // Status filter (comma-separated)
  if (query.status) {
    const statuses = String(query.status).split(',');
    conditions.push(inArray(ptProjects.status, statuses));
  }

  // Category filter
  if (query.categoryId) {
    conditions.push(eq(ptProjects.categoryId, Number(query.categoryId)));
  }

  // Archived filter
  if (query.archived === 'true') {
    // Show all including archived
  } else {
    conditions.push(eq(ptProjects.archived, false));
  }

  // Search filter
  if (query.search) {
    const term = `%${String(query.search)}%`;
    conditions.push(or(
      like(ptProjects.title, term),
      like(ptProjects.description, term),
    ));
  }

  // Base query
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const projects = await db
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
    .where(where)
    .orderBy(ptProjects.sortOrder);

  // Tag filter - if tagIds specified, filter post-join
  const tagFilter = query.tagIds ? String(query.tagIds).split(',').map(Number) : [];

  // Enrich with tags and counts
  const result = await Promise.all(projects.map(async (p) => {
    // Get tags for this project
    const projectTags = await db
      .select({ id: ptTags.id, name: ptTags.name, createdAt: ptTags.createdAt })
      .from(ptProjectTags)
      .innerJoin(ptTags, eq(ptProjectTags.tagId, ptTags.id))
      .where(eq(ptProjectTags.projectId, p.id));

    // Checklist counts
    const [checklistStats] = await db
      .select({
        total: sql<number>`count(*)`,
        done: sql<number>`sum(case when ${ptChecklistItems.isCompleted} = 1 then 1 else 0 end)`,
      })
      .from(ptChecklistItems)
      .where(eq(ptChecklistItems.projectId, p.id));

    // Note count
    const [noteStats] = await db
      .select({ count: sql<number>`count(*)` })
      .from(ptNotes)
      .where(eq(ptNotes.projectId, p.id));

    // Diagram count
    const [diagramStats] = await db
      .select({ count: sql<number>`count(*)` })
      .from(ptDiagrams)
      .where(eq(ptDiagrams.projectId, p.id));

    return {
      ...p,
      tags: projectTags,
      checklistTotal: checklistStats.total ?? 0,
      checklistDone: checklistStats.done ?? 0,
      noteCount: noteStats.count ?? 0,
      diagramCount: diagramStats.count ?? 0,
    };
  }));

  // Apply tag filter if specified
  if (tagFilter.length > 0) {
    return result.filter(p => tagFilter.some(tid => p.tags.some(t => t.id === tid)));
  }

  return result;
});
