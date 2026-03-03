<template>
  <nav class="bottom-nav">
    <NuxtLink
      v-for="tool in tools"
      :key="tool.id"
      :to="`/${tool.id}`"
      class="nav-tab"
      :class="{ active: currentToolId === tool.id }"
    >
      <component :is="tool.icon" class="tab-icon" :size="20" :stroke-width="1.5" />
      <span class="tab-label">{{ tool.name }}</span>
    </NuxtLink>

    <button class="nav-tab" @click="showMenu = !showMenu">
      <EllipsisVertical :size="20" :stroke-width="1.5" />
      <span class="tab-label">更多</span>
    </button>

    <!-- Overflow menu -->
    <div v-if="showMenu" class="menu-overlay" @click="showMenu = false" />
    <div v-if="showMenu" class="menu-popup">
      <button class="menu-item" @click="handleSettings">
        <Settings :size="16" :stroke-width="1.5" />
        <span>模型设置</span>
      </button>
      <button class="menu-item menu-item-danger" @click="handleLogout">
        <LogOut :size="16" :stroke-width="1.5" />
        <span>登出</span>
      </button>
    </div>

    <LlmSettings :open="showLlmSettings" @close="showLlmSettings = false" />
  </nav>
</template>

<script setup lang="ts">
import { EllipsisVertical, Settings, LogOut } from 'lucide-vue-next';

const { currentToolId, tools } = useCurrentTool();
const { logout } = useAuth();

const showMenu = ref(false);
const showLlmSettings = ref(false);

function handleSettings() {
  showMenu.value = false;
  showLlmSettings.value = true;
}

function handleLogout() {
  showMenu.value = false;
  logout();
}
</script>

<style scoped>
.bottom-nav {
  display: none;
}

@media (max-width: 768px) {
  .bottom-nav {
    display: flex;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: var(--bottom-nav-height);
    background-color: var(--color-bg-primary);
    border-top: 1px solid var(--color-border);
    z-index: 50;
  }

  .nav-tab {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-height: var(--touch-target-min);
    background: none;
    border: none;
    text-decoration: none;
    color: var(--color-text-secondary);
    font-size: 11px;
    cursor: pointer;
    transition: color var(--transition-fast);
    -webkit-tap-highlight-color: transparent;
  }

  .nav-tab.active {
    color: var(--color-accent);
  }

  .tab-icon {
    flex-shrink: 0;
  }

  .tab-label {
    line-height: 1;
  }

  .menu-overlay {
    position: fixed;
    inset: 0;
    z-index: 51;
  }

  .menu-popup {
    position: absolute;
    bottom: calc(var(--bottom-nav-height) + var(--spacing-xs));
    right: var(--spacing-sm);
    background-color: var(--color-bg-primary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
    z-index: 52;
    overflow: hidden;
    min-width: 140px;
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    min-height: var(--touch-target-min);
    background: none;
    border: none;
    font-size: 14px;
    color: var(--color-text-primary);
    cursor: pointer;
    transition: background-color var(--transition-fast);
  }

  .menu-item:hover {
    background-color: var(--color-bg-hover);
  }

  .menu-item-danger {
    color: var(--color-danger);
  }
}
</style>
