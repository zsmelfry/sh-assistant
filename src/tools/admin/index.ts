import { Users } from 'lucide-vue-next';
import { registerTool } from '~/composables/useToolRegistry';

registerTool({
  id: 'admin',
  name: '用户管理',
  icon: Users,
  order: 100,
  component: () => import('./Admin.vue'),
  namespaces: ['admin'],
});
