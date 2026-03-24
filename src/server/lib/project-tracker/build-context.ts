import { eq, sql, isNull, desc } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import {
  ptProjects, ptCategories, ptMilestones, ptChecklistItems,
  ptNotes, ptDiagrams,
} from '~/server/database/schema';

export async function buildProjectContext(db: BetterSQLite3Database<any>, projectId: number): Promise<string> {
  const parts: string[] = [];

  // 1. Basic info
  const [project] = await db.select({
    title: ptProjects.title,
    description: ptProjects.description,
    status: ptProjects.status,
    dueDate: ptProjects.dueDate,
    priority: ptProjects.priority,
    blockedReason: ptProjects.blockedReason,
    categoryName: ptCategories.name,
  }).from(ptProjects)
    .leftJoin(ptCategories, eq(ptProjects.categoryId, ptCategories.id))
    .where(eq(ptProjects.id, projectId))
    .limit(1);

  if (!project) return '';

  parts.push(`【事项】${project.title}`);
  parts.push(`状态: ${project.status} | 优先级: ${project.priority} | 分类: ${project.categoryName}`);
  if (project.dueDate) parts.push(`截止日期: ${project.dueDate}`);
  if (project.description) parts.push(`描述: ${project.description.slice(0, 300)}`);
  if (project.blockedReason) parts.push(`受阻原因: ${project.blockedReason}`);

  // 2. Checklist summary
  const milestones = await db.select({
    id: ptMilestones.id,
    title: ptMilestones.title,
  }).from(ptMilestones)
    .where(eq(ptMilestones.projectId, projectId))
    .orderBy(ptMilestones.sortOrder);

  if (milestones.length > 0) {
    parts.push('\n【里程碑与任务】');
    for (const m of milestones) {
      const [stats] = await db.select({
        total: sql<number>`count(*)`,
        done: sql<number>`sum(case when ${ptChecklistItems.isCompleted} = 1 then 1 else 0 end)`,
      }).from(ptChecklistItems)
        .where(eq(ptChecklistItems.milestoneId, m.id));

      const undone = await db.select({ content: ptChecklistItems.content })
        .from(ptChecklistItems)
        .where(eq(ptChecklistItems.milestoneId, m.id))
        .where(eq(ptChecklistItems.isCompleted, false))
        .limit(5);

      parts.push(`  ${m.title} (${stats.done ?? 0}/${stats.total ?? 0})`);
      if (undone.length > 0) {
        parts.push(`    未完成: ${undone.map(u => u.content).join(', ')}`);
      }
    }
  }

  // 3. Notes summary
  const notes = await db.select({
    title: ptNotes.title,
    aiSummary: ptNotes.aiSummary,
    content: ptNotes.content,
  }).from(ptNotes)
    .where(eq(ptNotes.projectId, projectId))
    .orderBy(desc(ptNotes.updatedAt))
    .limit(5);

  if (notes.length > 0) {
    parts.push('\n【笔记摘要】');
    for (const note of notes) {
      const summary = note.aiSummary || (note.content?.slice(0, 200) ?? '');
      parts.push(`  - ${note.title}: ${summary}`);
    }
  }

  // 4. Diagram summary
  const diagrams = await db.select({
    title: ptDiagrams.title,
    type: ptDiagrams.type,
    description: ptDiagrams.description,
  }).from(ptDiagrams)
    .where(eq(ptDiagrams.projectId, projectId));

  if (diagrams.length > 0) {
    parts.push('\n【图表】');
    for (const d of diagrams) {
      parts.push(`  - ${d.title} (${d.type})${d.description ? ': ' + d.description : ''}`);
    }
  }

  return parts.join('\n');
}
