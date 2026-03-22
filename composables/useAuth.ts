const TOKEN_KEY = 'auth_token';

const authState = reactive({
  token: null as string | null,
  initialized: false,
});

export function useAuth() {
  const { setPermissions, restore: restorePermissions, clear: clearPermissions } = useModulePermissions();

  /** Initialize from localStorage (call once on app startup) */
  function init() {
    if (authState.initialized) return;
    authState.token = localStorage.getItem(TOKEN_KEY);
    restorePermissions();
    // If token exists but no permissions stored (pre-migration session), force re-login
    if (authState.token && !localStorage.getItem('module_permissions')) {
      authState.token = null;
      localStorage.removeItem(TOKEN_KEY);
    }
    authState.initialized = true;
  }

  /** Whether user is currently authenticated */
  const isAuthenticated = computed(() => !!authState.token);

  /** Login: call API then store token + permissions */
  async function login(username: string, password: string) {
    const res = await $fetch<{ token: string; role: string; enabledModules: string[] }>('/api/auth/login', {
      method: 'POST',
      body: { username, password },
    });
    authState.token = res.token;
    localStorage.setItem(TOKEN_KEY, res.token);
    setPermissions(res.enabledModules || [], res.role || 'user');
  }

  /** Logout: clear token, permissions, and redirect to login */
  function logout() {
    authState.token = null;
    localStorage.removeItem(TOKEN_KEY);
    clearPermissions();
    navigateTo('/login');
  }

  /** Get current token (used by fetch interceptor) */
  function getToken(): string | null {
    return authState.token;
  }

  /** Get Authorization headers for native fetch calls (e.g. SSE streaming) */
  function getAuthHeaders(): Record<string, string> {
    const token = authState.token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  /** Clear token without redirect (used by 401 interceptor) */
  function clearToken() {
    authState.token = null;
    localStorage.removeItem(TOKEN_KEY);
    clearPermissions();
  }

  return { init, isAuthenticated, login, logout, getToken, getAuthHeaders, clearToken };
}
