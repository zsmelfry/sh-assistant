import { checkAndSendNotifications } from '~/server/lib/project-tracker/notifications';

export default defineEventHandler(async () => {
  await checkAndSendNotifications();
  return { success: true };
});
