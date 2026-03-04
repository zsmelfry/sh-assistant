<template>
  <div />
</template>

<script setup lang="ts">
const { getAll } = useToolRegistry();

onMounted(() => {
  const tools = getAll();
  if (tools.length > 0) {
    navigateTo(`/${tools[0].id}`, { replace: true });
  }
});
</script>
