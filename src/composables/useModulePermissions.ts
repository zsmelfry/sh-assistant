const PERMISSIONS_KEY = 'module_permissions';
const ROLE_KEY = 'user_role';

const enabledModules = ref<string[]>([]);
const role = ref('user');

export function useModulePermissions() {
  function isModuleEnabled(moduleId: string): boolean {
    return enabledModules.value.includes(moduleId);
  }

  function isAdmin(): boolean {
    return role.value === 'admin';
  }

  function setPermissions(modules: string[], newRole: string) {
    enabledModules.value = modules;
    role.value = newRole;
    localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(modules));
    localStorage.setItem(ROLE_KEY, newRole);
  }

  function restore() {
    try {
      const stored = localStorage.getItem(PERMISSIONS_KEY);
      if (stored) {
        enabledModules.value = JSON.parse(stored);
      }
      role.value = localStorage.getItem(ROLE_KEY) || 'user';
    } catch { /* ignore parse errors */ }
  }

  function clear() {
    enabledModules.value = [];
    role.value = 'user';
    localStorage.removeItem(PERMISSIONS_KEY);
    localStorage.removeItem(ROLE_KEY);
  }

  return { isModuleEnabled, isAdmin, setPermissions, restore, clear, enabledModules, role };
}
