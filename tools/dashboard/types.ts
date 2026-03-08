import type { GlobalContext } from '~/server/lib/coach/context-builder';

export interface DashboardSummary extends GlobalContext {}

export interface DailyInsight {
  content: string;
  date: string;
}

export interface ActivityItem {
  id: number;
  skillId: number | null;
  skillName: string | null;
  source: string;
  sourceRef: string | null;
  description: string;
  date: string;
  createdAt: number;
}
