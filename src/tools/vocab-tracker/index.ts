import { BookOpen } from 'lucide-vue-next';
import { registerTool } from '~/composables/useToolRegistry';

registerTool({
  id: 'vocab-tracker',
  name: '词汇学习',
  icon: BookOpen,
  order: 2,
  component: () => import('./VocabTracker.vue'),
  namespaces: ['vocab'],
});
