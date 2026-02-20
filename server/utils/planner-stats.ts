/**
 * Calculate completion rate as a percentage (0-100), returning 0 when there are no items.
 */
export function completionRate(completed: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

/**
 * Aggregate checkitem counts from an array of rows that each have
 * `totalCheckitems` and `completedCheckitems` fields.
 */
export function aggregateCheckitemCounts(
  rows: { totalCheckitems: number; completedCheckitems: number }[],
): { totalCheckitems: number; completedCheckitems: number } {
  let totalCheckitems = 0;
  let completedCheckitems = 0;
  for (const row of rows) {
    totalCheckitems += row.totalCheckitems;
    completedCheckitems += row.completedCheckitems;
  }
  return { totalCheckitems, completedCheckitems };
}
