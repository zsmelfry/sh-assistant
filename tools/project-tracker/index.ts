import { ClipboardList } from 'lucide-vue-next';
import { registerTool } from '~/composables/useToolRegistry';

registerTool({
  id: 'project-tracker',
  name: '事项追踪',
  icon: ClipboardList,
  order: 4,
  component: () => import('./ProjectTracker.vue'),
  namespaces: ['project-tracker'],
});
