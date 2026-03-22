import { MODULE_NAMESPACE_MAP } from '~/server/utils/module-ids';
import type { ModuleId } from '~/server/utils/module-ids';

// Build reverse lookup: namespace → moduleId
const NAMESPACE_TO_MODULE = new Map<string, ModuleId>();
for (const [moduleId, namespaces] of Object.entries(MODULE_NAMESPACE_MAP)) {
  for (const ns of namespaces) {
    NAMESPACE_TO_MODULE.set(ns, moduleId as ModuleId);
  }
}

export default defineEventHandler((event) => {
  const pathname = getRequestURL(event).pathname;

  // Only guard /api/* paths
  if (!pathname.startsWith('/api/')) return;

  // Skip paths that don't need module guarding
  if (
    pathname.startsWith('/api/admin/') ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/api/_test/') ||
    pathname.startsWith('/api/llm/') ||
    pathname.startsWith('/api/songs/')
  ) {
    // Admin paths require admin role
    if (pathname.startsWith('/api/admin/')) {
      if (event.context.auth?.role !== 'admin') {
        throw createError({ statusCode: 403, message: '需要管理员权限' });
      }
    }
    return;
  }

  // Extract namespace: /api/{namespace}/... → namespace
  const segments = pathname.slice(5).split('/'); // remove "/api/"
  const namespace = segments[0];
  if (!namespace) return;

  // Look up which module owns this namespace
  const moduleId = NAMESPACE_TO_MODULE.get(namespace);

  // Unmapped namespaces pass through
  if (!moduleId) return;

  // Check if the module is enabled for this user
  const enabledModules: string[] | undefined = event.context.auth?.enabledModules;
  if (!enabledModules || !enabledModules.includes(moduleId)) {
    throw createError({ statusCode: 403, message: '该模块未启用' });
  }
});
