import { Radar } from 'lucide-vue-next';
import { registerTool } from '~/composables/useToolRegistry';

registerTool({
  id: 'ability-profile',
  name: '能力画像',
  icon: Radar,
  order: 0,
  component: () => import('./AbilityProfile.vue'),
  namespaces: ['ability-skills', 'ability-categories', 'ability-stats', 'skill-templates'],
});
