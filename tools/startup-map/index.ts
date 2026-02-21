import { Map } from 'lucide-vue-next';
import { registerTool } from '~/composables/useToolRegistry';

registerTool({
  id: 'startup-map',
  name: '创业地图',
  icon: Map,
  order: 5,
  component: () => import('./StartupMap.vue'),
  namespaces: ['startup-map'],
});
