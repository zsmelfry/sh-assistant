import type { ChatMessage } from '~/server/lib/llm/types';

/** Valid point statuses — single source of truth for server-side validation */
export const VALID_POINT_STATUSES = ['not_started', 'learning', 'understood', 'practiced'] as const;
export type PointStatus = (typeof VALID_POINT_STATUSES)[number];

export const POINT_STATUS_LABELS: Record<PointStatus, string> = {
  not_started: '未开始',
  learning: '学习中',
  understood: '已理解',
  practiced: '已实践',
};

/** Activity types — shared between server and frontend */
export type ActivityType = 'view' | 'chat' | 'note' | 'task' | 'status_change';

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  view: '查看知识点',
  chat: 'AI 对话',
  note: '编辑笔记',
  task: '完成任务',
  status_change: '状态变更',
};

/** Teaching section keys (string union, distinct from TeachingSection interface below) */
export type TeachingSectionKey = 'what' | 'how' | 'example' | 'apply' | 'resources';

export const TEACHING_SECTION_KEYS: TeachingSectionKey[] = ['what', 'how', 'example', 'apply', 'resources'];

export const TEACHING_SECTION_KEY_LABELS: Record<TeachingSectionKey, string> = {
  what: '是什么',
  how: '怎么做',
  example: '案例',
  apply: '我的应用',
  resources: '推荐资源',
};

/** Context passed to AI prompt builders */
export interface SkillTeachingContext {
  point: { name: string; description: string | null };
  topic: { name: string };
  domain: { name: string };
}

/** Teaching section definition — keys must be what/how/example/apply/resources */
export interface TeachingSection {
  key: 'what' | 'how' | 'example' | 'apply' | 'resources';
  label: string;
}

/** Full skill configuration */
export interface SkillConfig {
  /** URL identifier, e.g. 'startup-map' */
  id: string;
  /** Display name, e.g. '创业地图' */
  name: string;

  // AI prompt builders
  buildTeachingPrompt: (ctx: SkillTeachingContext) => ChatMessage[];
  buildChatSystemMessage: (ctx: SkillTeachingContext & { teachingSummary: string }) => ChatMessage;
  buildTaskPrompt: (ctx: SkillTeachingContext) => ChatMessage[];

  // Configurable labels
  teachingSections: TeachingSection[];
  statusLabels: Record<string, string>;
  activityTypeLabels: Record<string, string>;
}
