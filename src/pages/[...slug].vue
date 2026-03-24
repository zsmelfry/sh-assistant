<template>
  <component
    v-if="currentTool"
    :is="toolComponent"
    v-bind="currentTool.props"
  />
  <div v-else class="not-found">
    工具未找到
  </div>
</template>

<script setup lang="ts">
const route = useRoute();
const { get } = useToolRegistry();
const { tools } = useCurrentTool();
const { isModuleEnabled, isAdmin } = useModulePermissions();

const toolId = computed(() => {
  const slug = route.params.slug;
  return Array.isArray(slug) ? slug[0] : slug;
});

const currentTool = computed(() => get(toolId.value));

const toolComponent = computed(() =>
  currentTool.value
    ? defineAsyncComponent(currentTool.value.component)
    : null
);

// Redirect if tool exists but module is not enabled, or tool not found
watch(toolId, (id) => {
  if (!id) return;

  const tool = get(id);
  const enabled = tools.value;

  if (tool) {
    // Tool exists — check if module is enabled
    const isAllowed = id === 'admin' ? isAdmin() : isModuleEnabled(id);
    if (!isAllowed && enabled.length > 0) {
      navigateTo(`/${enabled[0].id}`, { replace: true });
    }
  } else if (enabled.length > 0) {
    // Tool not found — redirect to first enabled
    navigateTo(`/${enabled[0].id}`, { replace: true });
  }
}, { immediate: true });
</script>

<style scoped>
.not-found {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-secondary);
  font-size: 16px;
}
</style>
