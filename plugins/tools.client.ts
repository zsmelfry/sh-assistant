import '~/tools';
import { resolveIcon } from '~/utils/icon-map';

export default defineNuxtPlugin(async () => {
  await registerSkillTools();
});

export async function registerSkillTools() {
  if (!useAuth().getToken()) return;

  try {
    const configs = await $fetch<Array<{ skillId: string; name: string; icon: string; sortOrder: number; isActive: boolean }>>('/api/skill-configs');
    const { register, getAll, unregister } = useToolRegistry();

    // Remove previously registered skill tools (keep static tools)
    const staticIds = new Set(['habit-tracker', 'vocab-tracker', 'annual-planner', 'article-reader', 'skill-manager', 'project-tracker']);
    for (const tool of getAll()) {
      if (!staticIds.has(tool.id)) {
        unregister(tool.id);
      }
    }

    for (const config of configs) {
      if (!config.isActive) continue;
      register({
        id: config.skillId,
        name: config.name,
        icon: resolveIcon(config.icon),
        order: config.sortOrder,
        component: () => import('~/tools/skill-learning/GenericSkillTool.vue'),
        namespaces: [config.skillId],
        props: { skillId: config.skillId },
      });
    }
  } catch (err) {
    console.warn('[skill-tools] Failed to load skill configs:', err);
  }
}
