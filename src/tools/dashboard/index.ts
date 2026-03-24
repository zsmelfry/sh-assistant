import { Home } from 'lucide-vue-next';
import { registerTool } from '~/composables/useToolRegistry';

registerTool({
  id: 'dashboard',
  name: '今日',
  icon: Home,
  order: 0,
  component: () => import('./Dashboard.vue'),
  namespaces: ['dashboard'],
});
