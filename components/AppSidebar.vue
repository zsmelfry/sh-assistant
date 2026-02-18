<template>
  <aside class="sidebar" :class="{ collapsed }">
    <div class="sidebar-header">
      <span v-if="!collapsed" class="sidebar-title">工具箱</span>
      <button
        class="toggle-btn"
        :aria-label="collapsed ? '展开侧边栏' : '折叠侧边栏'"
        @click="$emit('toggle')"
      >
        {{ collapsed ? '▶' : '◀' }}
      </button>
    </div>

    <nav class="sidebar-nav">
      <NuxtLink
        v-for="tool in tools"
        :key="tool.id"
        :to="`/${tool.id}`"
        class="nav-item"
        :class="{ active: currentToolId === tool.id }"
        :title="tool.name"
      >
        <component :is="iconMap[tool.icon]" class="nav-icon" :size="18" :stroke-width="1.5" />
        <span v-if="!collapsed" class="nav-label">{{ tool.name }}</span>
      </NuxtLink>
    </nav>
  </aside>
</template>

<script setup lang="ts">
import { CalendarCheck } from 'lucide-vue-next';
import type { Component } from 'vue';

const iconMap: Record<string, Component> = {
  'calendar-check': CalendarCheck,
};

defineProps<{
  collapsed: boolean;
}>();

defineEmits<{
  toggle: [];
}>();

const route = useRoute();
const { getAll } = useToolRegistry();

const tools = computed(() => getAll());

const currentToolId = computed(() => {
  const slug = route.params.slug;
  if (Array.isArray(slug)) return slug[0];
  return slug || '';
});
</script>

<style scoped>
.sidebar {
  width: var(--sidebar-width);
  background-color: var(--color-bg-sidebar);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  transition: width var(--transition-fast);
  overflow: hidden;
  flex-shrink: 0;
}

.sidebar.collapsed {
  width: var(--sidebar-width-collapsed);
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--color-border);
  min-height: 48px;
}

.sidebar-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--color-text-primary);
  white-space: nowrap;
}

.toggle-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: var(--spacing-xs);
  color: var(--color-text-secondary);
  font-size: 12px;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.toggle-btn:hover {
  background-color: var(--color-bg-hover);
}

.sidebar-nav {
  flex: 1;
  padding: var(--spacing-sm);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-sm);
  border-radius: var(--radius-sm);
  text-decoration: none;
  color: var(--color-text-secondary);
  font-size: 14px;
  transition: background-color var(--transition-fast);
  white-space: nowrap;
}

.nav-item:hover {
  background-color: var(--color-bg-hover);
}

.nav-item.active {
  background-color: var(--color-accent);
  color: var(--color-accent-inverse);
}

.nav-icon {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
}

.nav-label {
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
