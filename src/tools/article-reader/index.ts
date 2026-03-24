import { FileText } from 'lucide-vue-next';
import { registerTool } from '~/composables/useToolRegistry';

registerTool({
  id: 'article-reader',
  name: '文章阅读',
  icon: FileText,
  order: 5,
  component: () => import('./ArticleReader.vue'),
  namespaces: ['articles', 'bookmarks'],
});
