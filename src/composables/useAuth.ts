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
  async function login(email: string, password: string) {
    const res = await $fetch<{ token: string; role: string; enabledModules: string[] }>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    authState.token = res.token;
    localStorage.setItem(TOKEN_KEY, res.token);
    setPermissions(res.enabledModules || [], res.role || 'user');
  }

  /** Forgot password: send reset email */
  async function forgotPassword(email: string) {
    await $fetch('/api/auth/forgot-password', {
      method: 'POST',
      body: { email },
    });
  }

  /** Change password: update password and refresh token */
  async function changePassword(currentPassword: string, newPassword: string) {
    const res = await $fetch<{ token: string }>('/api/auth/change-password', {
      method: 'POST',
      body: { currentPassword, newPassword },
    });
    authState.token = res.token;
    localStorage.setItem(TOKEN_KEY, res.token);
  }

  /** Logout all devices: bump tokenVersion then clear local session */
  async function logoutAllDevices() {
    await $fetch('/api/auth/logout-all', { method: 'POST' });
    authState.token = null;
    localStorage.removeItem(TOKEN_KEY);
    clearPermissions();
    navigateTo('/login');
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

  return { init, isAuthenticated, login, forgotPassword, changePassword, logoutAllDevices, logout, getToken, getAuthHeaders, clearToken };
}
