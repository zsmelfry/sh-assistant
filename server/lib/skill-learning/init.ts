import { getSkill, registerSkill } from './registry';
import type { SkillConfig } from './types';

let initialized = false;

export async function ensureSkillsRegistered(): Promise<void> {
  if (initialized) return;
  initialized = true;

  // Dynamically import skill configs to avoid tree-shaking issues
  const mod = await import('./skills/startup-map');
  // The import itself triggers registerSkill() via module evaluation
  // But as a safety net, check if it's registered
  if (!getSkill('startup-map')) {
    console.warn('[skill-learning] startup-map not registered after import, this should not happen');
  }
}
