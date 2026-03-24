import { Settings } from 'lucide-vue-next';
import { registerTool } from '~/composables/useToolRegistry';

registerTool({
  id: 'skill-manager',
  name: '技能管理',
  icon: Settings,
  order: Infinity,
  component: () => import('./SkillManager.vue'),
  namespaces: ['skill-manager'],
});
