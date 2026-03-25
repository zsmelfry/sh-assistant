export default defineNuxtPlugin(() => {
  const { init, getToken, clearToken } = useAuth();

  // Initialize auth state from localStorage
  init();

  // Log session start (fire-and-forget)
  if (getToken()) {
    $fetch('/api/auth/session-start', { method: 'POST' }).catch(() => {});
  }

  // Intercept all $fetch requests: attach token + handle 401
  globalThis.$fetch = globalThis.$fetch.create({
    onRequest({ options }) {
      const token = getToken();
      if (token) {
        options.headers = options.headers || {};
        if (Array.isArray(options.headers)) {
          options.headers.push(['Authorization', `Bearer ${token}`]);
        } else if (options.headers instanceof Headers) {
          options.headers.set('Authorization', `Bearer ${token}`);
        } else {
          (options.headers as Record<string, string>).Authorization = `Bearer ${token}`;
        }
      }
    },
    onResponseError({ response }) {
      if (response.status === 401) {
        clearToken();
        navigateTo('/login');
      }
    },
  });
});
