/**
 * Shared composable for resolving the current tool from the route slug.
 * Used by AppSidebar and MobileBottomNav.
 */
export function useCurrentTool() {
  const route = useRoute();
  const { getAll } = useToolRegistry();

  const currentToolId = computed(() => {
    const slug = route.params.slug;
    return Array.isArray(slug) ? slug[0] : (slug || '');
  });

  const tools = computed(() => getAll());

  return { currentToolId, tools };
}
