<template>
  <div v-if="store.activeProduct" class="productSwitcher">
    <span class="productLabel">当前产品：</span>
    <span class="productName">{{ store.activeProduct.name }}</span>
  </div>
</template>

<script setup lang="ts">
const store = useStartupMapStore();
</script>

<style scoped>
.productSwitcher {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: 12px;
  color: var(--color-text-secondary);
}

.productName {
  font-weight: 600;
  color: var(--color-text-primary);
}
</style>
