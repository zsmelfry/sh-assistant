/**
 * Shared composable for resolving the current tool from the route slug.
 * Filters tools by module permissions.
 * Used by AppSidebar and MobileBottomNav.
 */
export function useCurrentTool() {
  const route = useRoute();
  const { getAll } = useToolRegistry();
  const { isModuleEnabled, isAdmin } = useModulePermissions();

  const currentToolId = computed(() => {
    const slug = route.params.slug;
    return Array.isArray(slug) ? slug[0] : (slug || '');
  });

  const tools = computed(() =>
    getAll().filter((tool) => {
      // Admin tool only visible to admins
      if (tool.id === 'admin') return isAdmin();
      // Other tools filtered by module permission
      return isModuleEnabled(tool.id);
    }),
  );

  return { currentToolId, tools };
}
