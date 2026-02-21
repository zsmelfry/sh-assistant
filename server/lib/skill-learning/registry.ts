import type { SkillConfig } from './types';

const skills = new Map<string, SkillConfig>();

export function registerSkill(config: SkillConfig): void {
  skills.set(config.id, config);
}

export function getSkill(id: string): SkillConfig | undefined {
  return skills.get(id);
}

export function requireSkill(id: string): SkillConfig {
  const skill = skills.get(id);
  if (!skill) {
    throw createError({ statusCode: 404, message: `技能 '${id}' 不存在` });
  }
  return skill;
}

export function getAllSkillIds(): string[] {
  return Array.from(skills.keys());
}
