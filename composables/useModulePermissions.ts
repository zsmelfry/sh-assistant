const PERMISSIONS_KEY = 'module_permissions';
const ROLE_KEY = 'user_role';

const permState = reactive({
  enabledModules: new Set<string>(),
  role: 'user' as string,
});

export function useModulePermissions() {
  function isModuleEnabled(moduleId: string): boolean {
    return permState.enabledModules.has(moduleId);
  }

  function isAdmin(): boolean {
    return permState.role === 'admin';
  }

  function setPermissions(modules: string[], role: string) {
    permState.enabledModules = new Set(modules);
    permState.role = role;
    localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(modules));
    localStorage.setItem(ROLE_KEY, role);
  }

  function restore() {
    try {
      const stored = localStorage.getItem(PERMISSIONS_KEY);
      if (stored) {
        permState.enabledModules = new Set(JSON.parse(stored));
      }
      permState.role = localStorage.getItem(ROLE_KEY) || 'user';
    } catch { /* ignore parse errors */ }
  }

  function clear() {
    permState.enabledModules = new Set();
    permState.role = 'user';
    localStorage.removeItem(PERMISSIONS_KEY);
    localStorage.removeItem(ROLE_KEY);
  }

  return { isModuleEnabled, isAdmin, setPermissions, restore, clear, enabledModules: permState.enabledModules, role: computed(() => permState.role) };
}
