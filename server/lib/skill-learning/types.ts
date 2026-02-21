import type { ChatMessage } from '~/server/lib/llm/types';
import type { SeedDomain, SeedStage } from '~/server/database/seeds/startup-map';

/** Context passed to AI prompt builders */
export interface SkillTeachingContext {
  point: { name: string; description: string | null };
  topic: { name: string };
  domain: { name: string };
  extra?: Record<string, any>;
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

  /** Optional: inject extra context before AI calls (e.g. startup-map's active product) */
  resolveExtraContext?: (
    db: any,
    ctx: { point: { name: string; description: string | null }; topic: { name: string }; domain: { name: string } },
  ) => Promise<Record<string, any>>;

  /** Seed data for this skill */
  seedData: { domains: SeedDomain[]; stages: SeedStage[] };
}
