export const ALL_MODULE_IDS = [
  'dashboard',
  'ability-profile',
  'habit-tracker',
  'annual-planner',
  'vocab-tracker',
  'article-reader',
  'project-tracker',
  'skill-manager',
  'xiaoshuang',
] as const;

export type ModuleId = typeof ALL_MODULE_IDS[number];

// Map: module ID → API namespace prefixes that belong to this module
export const MODULE_NAMESPACE_MAP: Record<ModuleId, string[]> = {
  'dashboard': ['dashboard', 'badges'],
  'ability-profile': ['ability-skills', 'ability-categories', 'ability-stats', 'skill-templates'],
  'habit-tracker': ['habits', 'checkins'],
  'annual-planner': ['planner'],
  'vocab-tracker': ['vocab'],
  'article-reader': ['articles', 'bookmarks', 'article-tags'],
  'project-tracker': ['project-tracker'],
  'skill-manager': ['skill-configs', 'skills'],
  'xiaoshuang': ['xiaoshuang'],
};
