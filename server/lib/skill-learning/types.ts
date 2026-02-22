import type { ChatMessage } from '~/server/lib/llm/types';

/** Valid point statuses — single source of truth for server-side validation */
export const VALID_POINT_STATUSES = ['not_started', 'learning', 'understood', 'practiced'] as const;
export type PointStatus = (typeof VALID_POINT_STATUSES)[number];

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
