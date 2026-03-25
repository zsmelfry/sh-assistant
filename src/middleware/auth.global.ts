export default defineNuxtRouteMiddleware((to) => {
  // Skip on server (SPA mode, but just in case)
  if (import.meta.server) return;

  const { isAuthenticated } = useAuth();

  // Allow access to login, invite, forgot-password, and reset-password pages without auth
  if (to.path === '/login' || to.path.startsWith('/invite/') || to.path === '/forgot-password' || to.path.startsWith('/reset-password/')) {
    // If already authenticated, redirect away from login
    if (isAuthenticated.value && to.path === '/login') {
      return navigateTo('/');
    }
    return;
  }

  // All other routes require authentication
  if (!isAuthenticated.value) {
    return navigateTo('/login');
  }
});
