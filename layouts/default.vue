<template>
  <div class="layout">
    <AppSidebar
      :collapsed="sidebarCollapsed"
      @toggle="sidebarCollapsed = !sidebarCollapsed"
    />
    <main class="main">
      <slot />
    </main>
    <MobileBottomNav />
    <XiaoshuangChat v-if="xiaoshuangStore.isOpen" />
  </div>
</template>

<script setup lang="ts">
import { useXiaoshuangStore } from '~/stores/xiaoshuang';

const sidebarCollapsed = ref(false);
const xiaoshuangStore = useXiaoshuangStore();

// Load notification count on mount
onMounted(() => {
  xiaoshuangStore.loadPendingCount();
});
</script>

<style scoped>
.layout {
  display: flex;
  height: 100vh;
}
.main {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-lg);
}

@media (max-width: 768px) {
  .main {
    padding: var(--spacing-sm) var(--spacing-md);
    padding-bottom: calc(var(--bottom-nav-height) + var(--spacing-md));
  }
}
</style>
