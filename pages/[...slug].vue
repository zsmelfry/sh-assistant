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
const { get, getAll } = useToolRegistry();

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

// Redirect to first registered tool if current tool not found
watch(toolId, (id) => {
  if (id && !get(id)) {
    const all = getAll();
    navigateTo(all.length > 0 ? `/${all[0].id}` : '/', { replace: true });
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
