export default defineNuxtRouteMiddleware((to) => {
  // Skip on server (SPA mode, but just in case)
  if (import.meta.server) return;

  const { isAuthenticated } = useAuth();

  // Allow access to login page without auth
  if (to.path === '/login') {
    // If already authenticated, redirect away from login
    if (isAuthenticated.value) {
      return navigateTo('/');
    }
    return;
  }

  // All other routes require authentication
  if (!isAuthenticated.value) {
    return navigateTo('/login');
  }
});
