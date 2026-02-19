const TOKEN_KEY = 'auth_token';

const authState = reactive({
  token: null as string | null,
  initialized: false,
});

export function useAuth() {
  /** Initialize from localStorage (call once on app startup) */
  function init() {
    if (authState.initialized) return;
    authState.token = localStorage.getItem(TOKEN_KEY);
    authState.initialized = true;
  }

  /** Whether user is currently authenticated */
  const isAuthenticated = computed(() => !!authState.token);

  /** Login: call API then store token */
  async function login(username: string, password: string) {
    const { token } = await $fetch<{ token: string }>('/api/auth/login', {
      method: 'POST',
      body: { username, password },
    });
    authState.token = token;
    localStorage.setItem(TOKEN_KEY, token);
  }

  /** Logout: clear token and redirect to login */
  function logout() {
    authState.token = null;
    localStorage.removeItem(TOKEN_KEY);
    navigateTo('/login');
  }

  /** Get current token (used by fetch interceptor) */
  function getToken(): string | null {
    return authState.token;
  }

  /** Clear token without redirect (used by 401 interceptor) */
  function clearToken() {
    authState.token = null;
    localStorage.removeItem(TOKEN_KEY);
  }

  return { init, isAuthenticated, login, logout, getToken, clearToken };
}
