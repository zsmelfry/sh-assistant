import { checkAndSendNotifications } from '~/server/lib/project-tracker/notifications';

const ONE_HOUR = 60 * 60 * 1000;

export default defineNitroPlugin(() => {
  // Check notifications every hour
  const timer = setInterval(async () => {
    try {
      await checkAndSendNotifications();
    } catch {
      // Silently ignore errors in background check
    }
  }, ONE_HOUR);

  // Run initial check after 10 seconds (let DB initialize)
  setTimeout(async () => {
    try {
      await checkAndSendNotifications();
    } catch {
      // Silently ignore
    }
  }, 10000);
});
