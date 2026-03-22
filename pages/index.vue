<template>
  <div />
</template>

<script setup lang="ts">
const { tools } = useCurrentTool();

onMounted(() => {
  const enabled = tools.value;
  if (enabled.length > 0) {
    navigateTo(`/${enabled[0].id}`, { replace: true });
  }
});
</script>
