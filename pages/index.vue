<template>
  <div />
</template>

<script setup lang="ts">
const { getAll } = useToolRegistry();
const router = useRouter();

onMounted(() => {
  const tools = getAll();
  if (tools.length > 0) {
    router.replace(`/${tools[0].id}`);
  }
});
</script>
