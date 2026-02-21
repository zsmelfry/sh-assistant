export type Priority = 'high' | 'medium' | 'low';

export type PlannerView =
  | { type: 'overview' }
  | { type: 'domain'; domainId: number }
  | { type: 'tags' };

export interface PlannerDomain {
  id: number;
  name: string;
  year: number;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface DomainWithStats extends PlannerDomain {
  goalCount: number;
  totalCheckitems: number;
  completedCheckitems: number;
  completionRate: number;
}

export interface PlannerGoal {
  id: number;
  domainId: number;
  title: string;
  description: string;
  priority: Priority;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface GoalWithDetails extends PlannerGoal {
  tags: PlannerTag[];
  checkitems: PlannerCheckitem[];
  totalCheckitems: number;
  completedCheckitems: number;
  isStagnant: boolean;
}

export interface PlannerCheckitem {
  id: number;
  goalId: number;
  content: string;
  isCompleted: boolean;
  completedAt: number | null;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface PlannerTag {
  id: number;
  name: string;
  createdAt: number;
}

export interface OverviewStats {
  totalGoals: number;
  totalCheckitems: number;
  completedCheckitems: number;
  globalCompletionRate: number;
  stagnantGoalCount: number;
  domains: DomainWithStats[];
}

export interface TagStats {
  id: number;
  name: string;
  goalCount: number;
  totalCheckitems: number;
  completedCheckitems: number;
  completionRate: number;
  goals: { id: number; title: string; domainName: string; completionRate: number }[];
}

export interface DomainGoalStats {
  id: number;
  name: string;
  goalCount: number;
  totalCheckitems: number;
  completedCheckitems: number;
  completionRate: number;
  goals: { id: number; title: string; tagNames: string; completionRate: number }[];
}

export interface CreateGoalData {
  domainId: number;
  title: string;
  description?: string;
  priority?: Priority;
  tagIds?: number[];
}

export interface UpdateGoalData {
  title?: string;
  description?: string;
  priority?: Priority;
  tagIds?: number[];
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

export const PRIORITY_ORDER: Record<Priority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export const DEFAULT_DOMAINS = ['事业', '财务', '健康', '兴趣'];

export const STAGNANT_THRESHOLD_DAYS = 14;
