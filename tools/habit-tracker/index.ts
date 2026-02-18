import { registerTool } from '~/composables/useToolRegistry';

registerTool({
  id: 'habit-tracker',
  name: '日历打卡',
  icon: 'calendar-check',
  order: 1,
  component: () => import('./HabitTracker.vue'),
  namespaces: ['habits', 'checkins'],
});
