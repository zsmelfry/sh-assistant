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
        <span class="nav-icon-wrap">
          <component :is="tool.icon" class="nav-icon" :size="18" :stroke-width="1.5" />
        </span>
        <span v-if="!collapsed" class="nav-label">{{ tool.name }}</span>
      </NuxtLink>
    </nav>

    <div class="sidebar-footer">
      <button
        v-if="isModuleEnabled('xiaoshuang')"
        class="settings-btn xiaoshuang-btn"
        title="小爽助手"
        @click="xiaoshuangStore.toggle()"
      >
        <span class="nav-icon-wrap">
          <MessageCircle :size="18" :stroke-width="1.5" />
          <span
            v-if="xiaoshuangStore.unreadCount > 0"
            class="nav-badge"
          >{{ xiaoshuangStore.unreadCount > 9 ? '9+' : xiaoshuangStore.unreadCount }}</span>
        </span>
        <span v-if="!collapsed" class="nav-label">小爽助手</span>
      </button>
      <button
        class="settings-btn"
        title="LLM 模型设置"
        @click="showLlmSettings = true"
      >
        <Settings :size="18" :stroke-width="1.5" />
        <span v-if="!collapsed" class="nav-label">模型设置</span>
      </button>

      <div class="user-section">
        <button
          class="settings-btn user-btn"
          :title="username || '用户'"
          @click="showUserMenu = !showUserMenu"
        >
          <User :size="18" :stroke-width="1.5" />
          <span v-if="!collapsed" class="nav-label">{{ username || '用户' }}</span>
        </button>

        <div v-if="showUserMenu" class="user-menu-overlay" @click="showUserMenu = false" />
        <div v-if="showUserMenu" class="user-menu">
          <button class="user-menu-item" @click="handleChangePassword">
            <KeyRound :size="14" :stroke-width="1.5" />
            <span>修改密码</span>
          </button>
          <button class="user-menu-item" @click="handleLogoutAll">
            <MonitorOff :size="14" :stroke-width="1.5" />
            <span>登出所有设备</span>
          </button>
          <button class="user-menu-item user-menu-item-danger" @click="handleLogout">
            <LogOut :size="14" :stroke-width="1.5" />
            <span>退出登录</span>
          </button>
        </div>
      </div>
    </div>

    <LlmSettings :open="showLlmSettings" @close="showLlmSettings = false" />
    <ChangePasswordModal v-if="showChangePassword" @close="showChangePassword = false" />
  </aside>
</template>

<script setup lang="ts">
import { Settings, ChevronLeft, ChevronRight, LogOut, MessageCircle, User, KeyRound, MonitorOff } from 'lucide-vue-next';
import { useXiaoshuangStore } from '~/stores/xiaoshuang';
import ChangePasswordModal from '~/components/ChangePasswordModal.vue';

defineProps<{
  collapsed: boolean;
}>();

defineEmits<{
  toggle: [];
}>();

const { currentToolId, tools } = useCurrentTool();
const { logout, logoutAllDevices, getToken } = useAuth();
const { isModuleEnabled } = useModulePermissions();
const showLlmSettings = ref(false);
const showUserMenu = ref(false);
const showChangePassword = ref(false);

const xiaoshuangStore = useXiaoshuangStore();

// Extract username from JWT
const username = computed(() => {
  const token = getToken();
  if (!token) return '';
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.username || '';
  } catch {
    return '';
  }
});

function handleChangePassword() {
  showUserMenu.value = false;
  showChangePassword.value = true;
}

async function handleLogoutAll() {
  showUserMenu.value = false;
  if (!confirm('确定要登出所有设备？当前设备也会退出登录。')) return;
  try {
    await logoutAllDevices();
  } catch {
    // logoutAllDevices already navigates to /login
  }
}

function handleLogout() {
  showUserMenu.value = false;
  logout();
}
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

.nav-icon-wrap {
  position: relative;
  flex-shrink: 0;
  width: 18px;
  height: 18px;
}

.nav-icon {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
}

.nav-badge {
  position: absolute;
  top: -6px;
  right: -8px;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  font-size: 9px;
  font-weight: 700;
  line-height: 14px;
  text-align: center;
  color: var(--color-accent-inverse);
  background-color: var(--color-accent);
  border-radius: 7px;
  pointer-events: none;
}

.nav-item.active .nav-badge {
  background-color: var(--color-accent-inverse);
  color: var(--color-accent);
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

.xiaoshuang-btn {
  margin-bottom: var(--spacing-xs);
}

/* User section */
.user-section {
  position: relative;
  margin-top: var(--spacing-xs);
  border-top: 1px solid var(--color-border);
  padding-top: var(--spacing-xs);
}

.user-btn {
  font-weight: 500;
}

.user-menu-overlay {
  position: fixed;
  inset: 0;
  z-index: 99;
}

.user-menu {
  position: absolute;
  bottom: 100%;
  left: var(--spacing-xs);
  right: var(--spacing-xs);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  z-index: 100;
  overflow: hidden;
  margin-bottom: var(--spacing-xs);
}

.user-menu-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  border: none;
  background: transparent;
  color: var(--color-text-primary);
  font-size: 13px;
  cursor: pointer;
  transition: background-color var(--transition-fast);
  white-space: nowrap;
}

.user-menu-item:hover {
  background-color: var(--color-bg-hover);
}

.user-menu-item-danger {
  color: var(--color-danger);
}

@media (max-width: 768px) {
  .sidebar {
    display: none;
  }
}
</style>
