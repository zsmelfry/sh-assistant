import { Target } from 'lucide-vue-next';
import { registerTool } from '~/composables/useToolRegistry';

registerTool({
  id: 'annual-planner',
  name: '年度计划',
  icon: Target,
  order: 3,
  component: () => import('./AnnualPlanner.vue'),
  namespaces: ['planner'],
});
