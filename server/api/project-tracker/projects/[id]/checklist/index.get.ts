import { eq, sql, inArray } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { ptChecklistItems, ptChecklistAttachments, ptMilestones, ptNotes, ptDiagrams, ptProjects } from '~/server/database/schema';
import { requireNumericParam, requireEntity } from '~/server/utils/handler-helpers';
import { PRIORITY_ORDER } from '~/types/priority';

export default defineEventHandler(async (event) => {
  const projectId = requireNumericParam(event, 'id', '事项');
  const db = useDB();
  await requireEntity(db, ptProjects, projectId, '事项');

  // Get milestones
  const milestones = await db.select().from(ptMilestones)
    .where(eq(ptMilestones.projectId, projectId))
    .orderBy(ptMilestones.sortOrder);

  // Get all checklist items
  const items = await db.select().from(ptChecklistItems)
    .where(eq(ptChecklistItems.projectId, projectId))
    .orderBy(ptChecklistItems.sortOrder);

  // Get attachment counts per checklist item
  const itemIds = items.map(i => i.id);
  let attachmentCounts = new Map<number, number>();
  if (itemIds.length > 0) {
    const counts = await db
      .select({
        checklistItemId: ptChecklistAttachments.checklistItemId,
        count: sql<number>`count(*)`,
      })
      .from(ptChecklistAttachments)
      .where(inArray(ptChecklistAttachments.checklistItemId, itemIds))
      .groupBy(ptChecklistAttachments.checklistItemId);
    attachmentCounts = new Map(counts.map(c => [c.checklistItemId, c.count]));
  }

  // Get linked note titles
  const noteIds = [...new Set(items.filter(i => i.linkedNoteId).map(i => i.linkedNoteId!))];
  let noteTitles = new Map<number, string>();
  if (noteIds.length > 0) {
    const notes = await db.select({ id: ptNotes.id, title: ptNotes.title })
      .from(ptNotes)
      .where(inArray(ptNotes.id, noteIds));
    noteTitles = new Map(notes.map(n => [n.id, n.title]));
  }

  // Get linked diagram titles
  const diagramIds = [...new Set(items.filter(i => i.linkedDiagramId).map(i => i.linkedDiagramId!))];
  let diagramTitles = new Map<number, string>();
  if (diagramIds.length > 0) {
    const diagrams = await db.select({ id: ptDiagrams.id, title: ptDiagrams.title })
      .from(ptDiagrams)
      .where(inArray(ptDiagrams.id, diagramIds));
    diagramTitles = new Map(diagrams.map(d => [d.id, d.title]));
  }

  // Enrich items with extra data
  const enrichedItems = items.map(item => ({
    ...item,
    attachmentCount: attachmentCounts.get(item.id) || 0,
    linkedNoteTitle: item.linkedNoteId ? (noteTitles.get(item.linkedNoteId) || null) : null,
    linkedDiagramTitle: item.linkedDiagramId ? (diagramTitles.get(item.linkedDiagramId) || null) : null,
  }));

  // Sort by priority then sortOrder
  function sortItems(list: typeof enrichedItems) {
    return list.sort((a, b) => {
      const pDiff = (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1);
      if (pDiff !== 0) return pDiff;
      return a.sortOrder - b.sortOrder;
    });
  }

  // Group by milestone
  const groups = milestones.map(m => {
    const groupItems = sortItems(enrichedItems.filter(i => i.milestoneId === m.id));
    return {
      ...m,
      items: groupItems,
      total: groupItems.length,
      done: groupItems.filter(i => i.isCompleted).length,
    };
  });

  // Ungrouped items
  const ungrouped = sortItems(enrichedItems.filter(i => i.milestoneId === null));
  if (ungrouped.length > 0) {
    groups.push({
      id: 0,
      projectId,
      title: '未分组',
      dueDate: null,
      sortOrder: 999999,
      createdAt: 0,
      items: ungrouped,
      total: ungrouped.length,
      done: ungrouped.filter(i => i.isCompleted).length,
    });
  }

  return groups;
});
