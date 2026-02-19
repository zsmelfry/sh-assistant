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
  </div>
</template>

<script setup lang="ts">
const sidebarCollapsed = ref(false);
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
    padding: var(--spacing-md);
    padding-bottom: calc(var(--bottom-nav-height) + var(--spacing-md));
  }
}
</style>
