// Side-effect import: register all skills
import './skills/startup-map';

// Public API
export type { SkillConfig, SkillTeachingContext, TeachingSection } from './types';
export { registerSkill, getSkill, requireSkill, getAllSkillIds } from './registry';
export { resolveSkill, requirePointForSkill } from './db-helpers';
