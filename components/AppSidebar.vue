<template>
  <aside class="sidebar" :class="{ collapsed }">
    <div class="sidebar-header">
      <span v-if="!collapsed" class="sidebar-title">工具箱</span>
      <button
        class="toggle-btn"
        :aria-label="collapsed ? '展开侧边栏' : '折叠侧边栏'"
        @click="$emit('toggle')"
      >
        <component :is="collapsed ? ChevronRight : ChevronLeft" :size="14" :stroke-width="1.5" />
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
        <component :is="tool.icon" class="nav-icon" :size="18" :stroke-width="1.5" />
        <span v-if="!collapsed" class="nav-label">{{ tool.name }}</span>
      </NuxtLink>
    </nav>

    <div class="sidebar-footer">
      <button
        class="settings-btn"
        title="LLM 模型设置"
        @click="showLlmSettings = true"
      >
        <Settings :size="18" :stroke-width="1.5" />
        <span v-if="!collapsed" class="nav-label">模型设置</span>
      </button>
      <button
        class="settings-btn logout-btn"
        title="登出"
        @click="logout"
      >
        <LogOut :size="18" :stroke-width="1.5" />
        <span v-if="!collapsed" class="nav-label">登出</span>
      </button>
    </div>

    <LlmSettings :open="showLlmSettings" @close="showLlmSettings = false" />
  </aside>
</template>

<script setup lang="ts">
import { Settings, ChevronLeft, ChevronRight, LogOut } from 'lucide-vue-next';

defineProps<{
  collapsed: boolean;
}>();

defineEmits<{
  toggle: [];
}>();

const route = useRoute();
const { getAll } = useToolRegistry();

const { logout } = useAuth();
const tools = computed(() => getAll());
const showLlmSettings = ref(false);

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

.sidebar-footer {
  padding: var(--spacing-sm);
  border-top: 1px solid var(--color-border);
}

.settings-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  width: 100%;
  padding: var(--spacing-sm);
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 14px;
  cursor: pointer;
  transition: background-color var(--transition-fast);
  white-space: nowrap;
}

.settings-btn:hover {
  background-color: var(--color-bg-hover);
}

.logout-btn {
  margin-top: var(--spacing-xs);
}

@media (max-width: 768px) {
  .sidebar {
    display: none;
  }
}
</style>
