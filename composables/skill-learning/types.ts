// ===== Shared Skill Learning Types =====
// Extracted from tools/startup-map/types.ts — generic types reusable across all skill tools.

// Import shared constants from server (single source of truth)
import type { PointStatus, ActivityType, TeachingSectionKey } from '~/server/lib/skill-learning/types';
export type { PointStatus, ActivityType };
export type { TeachingSectionKey as TeachingSection };
export {
  POINT_STATUS_LABELS,
  ACTIVITY_TYPE_LABELS,
  TEACHING_SECTION_KEYS as TEACHING_SECTIONS,
  TEACHING_SECTION_KEY_LABELS as TEACHING_SECTION_LABELS,
} from '~/server/lib/skill-learning/types';

// ===== 视图类型 =====
export type SkillLearningView = 'global' | 'domain' | 'point';

// ===== 全局视图 Tab =====
export type GlobalTab = 'domains' | 'stages' | 'heatmap';

// ===== 数据库实体类型 =====

export interface SmDomain {
  id: number;
  name: string;
  description: string | null;
  sortOrder: number;
  createdAt: number;
}

export interface SmTopic {
  id: number;
  domainId: number;
  name: string;
  description: string | null;
  sortOrder: number;
  createdAt: number;
}

export interface SmPoint {
  id: number;
  topicId: number;
  name: string;
  description: string | null;
  status: PointStatus;
  statusUpdatedAt: number | null;
  sortOrder: number;
  createdAt: number;
}

export interface SmTeaching {
  id: number;
  pointId: number;
  what: string | null;
  how: string | null;
  example: string | null;
  apply: string | null;
  resources: string | null;
  productId: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface SmChat {
  id: number;
  pointId: number;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
}

export interface SmStage {
  id: number;
  name: string;
  description: string | null;
  objective: string | null;
  sortOrder: number;
}

export interface SmTask {
  id: number;
  pointId: number;
  description: string;
  expectedOutput: string | null;
  hint: string | null;
  isCompleted: boolean;
  completionNote: string | null;
  completedAt: number | null;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface SmNote {
  id: number;
  pointId: number;
  productId: number | null;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface SmActivity {
  id: number;
  pointId: number | null;
  type: ActivityType;
  date: string;
  createdAt: number;
}

// ===== API 响应类型 =====

export interface DomainWithStats extends SmDomain {
  topicCount: number;
  pointCount: number;
  completedCount: number;
  completionRate: number;
}

export interface TopicWithPoints extends SmTopic {
  points: SmPoint[];
}

export interface DomainDetail extends SmDomain {
  topics: TopicWithPoints[];
}

export interface PointDetail extends SmPoint {
  teaching: SmTeaching | null;
  topic: { id: number; name: string };
  domain: { id: number; name: string };
}

export interface GlobalStats {
  totalPoints: number;
  completedCount: number;
  completionRate: number;
}

export interface EnhancedGlobalStats {
  totalPoints: number;
  notStarted: number;
  learning: number;
  understood: number;
  practiced: number;
  completionRate: number;
  currentStageId: number | null;
}

export interface DomainStatItem {
  id: number;
  name: string;
  total: number;
  notStarted: number;
  learning: number;
  understood: number;
  practiced: number;
  rate: number;
}

export interface StageWithStats extends SmStage {
  pointCount: number;
  completedCount: number;
  isCurrent: boolean;
}

export interface StagePointItem {
  pointId: number;
  name: string;
  status: PointStatus;
  domain: { id: number; name: string };
  topic: { id: number; name: string };
  sortOrder: number;
}

export interface StageDetail extends SmStage {
  points: StagePointItem[];
  pointCount: number;
  completedCount: number;
}

export interface RecommendedPoint {
  pointId: number;
  name: string;
  status: PointStatus;
  domain: { id: number; name: string };
  topic: { id: number; name: string };
  stage: { id: number; name: string } | null;
}

// ===== 活动类型 (re-exported from server) =====

export interface ActivityWithPointName extends SmActivity {
  pointName: string | null;
}

export interface ActivitiesPage {
  items: ActivityWithPointName[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ===== 文章关联 =====

export interface LinkedArticle {
  articleId: number;
  title: string;
  url: string;
  siteName: string | null;
  bookmarkedAt: number | null;
  linkedAt: number;
}

export interface LinkedPoint {
  pointId: number;
  pointName: string;
  status: PointStatus;
  topicName: string;
  domainName: string;
  linkedAt: number;
}

// ===== Chat response =====

export interface ChatResponse {
  userMessage: SmChat;
  assistantMessage: SmChat;
}
