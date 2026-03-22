import type { useDB } from '~/server/database';
import { activityLogs } from '~/server/database/schema';

interface LogActivityParams {
  skillId?: number | null;
  categoryId?: number | null;
  source: string;
  sourceRef?: string | null;
  description: string;
  date?: string; // YYYY-MM-DD, defaults to today
}

/**
 * Record an activity log entry.
 * Used by various modules to track user activity for the ability profile system.
 * Caller must pass the db instance obtained from useDB().
 */
export async function logActivity(db: ReturnType<typeof useDB>, params: LogActivityParams) {
  const now = Date.now();
  const today = params.date || new Date().toISOString().slice(0, 10);

  await db.insert(activityLogs).values({
    skillId: params.skillId ?? null,
    categoryId: params.categoryId ?? null,
    source: params.source,
    sourceRef: params.sourceRef ?? null,
    description: params.description,
    date: today,
    createdAt: now,
  });
}
