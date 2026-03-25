<template>
  <div class="user-list">
    <div
      v-for="user in users"
      :key="user.id"
      class="user-card"
      :class="{ expanded: expandedId === user.id }"
    >
      <div class="user-row">
        <div class="user-identity">
          <div class="user-avatar">{{ user.username.charAt(0).toUpperCase() }}</div>
          <div class="user-meta">
            <span class="username">{{ user.username }}</span>
            <span
              class="role-badge"
              :class="user.role"
            >{{ user.role === 'admin' ? '管理员' : '用户' }}</span>
          </div>
        </div>

        <div class="user-stats">
          <div class="stat stat-email">
            <span class="stat-label">邮箱</span>
            <span
              v-if="editingEmailUserId !== user.id"
              class="stat-value mono email-display"
              :class="{ placeholder: !user.email }"
              @click="startEditEmail(user)"
            >{{ user.email || '未设置' }}</span>
            <input
              v-else
              ref="emailInputRef"
              v-model="editingEmailValue"
              type="email"
              class="email-input mono"
              placeholder="user@example.com"
              @blur="saveEmail(user.id)"
              @keydown.enter="($event.target as HTMLInputElement).blur()"
              @keydown.escape="cancelEditEmail"
            />
          </div>
          <div class="stat">
            <span class="stat-label">创建</span>
            <span class="stat-value mono">{{ formatDate(user.createdAt) }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">数据</span>
            <span class="stat-value mono">{{ formatSize(user.dbSize) }}</span>
          </div>
        </div>

        <div class="user-actions">
          <button
            class="action-btn"
            title="模块权限"
            :class="{ active: expandedId === user.id }"
            @click="$emit('toggleExpand', user.id)"
          >
            <ChevronDown :size="16" class="expand-icon" :class="{ rotated: expandedId === user.id }" />
          </button>
          <button class="action-btn" title="重置密码" @click="$emit('resetPassword', user)">
            <KeyRound :size="16" />
          </button>
          <button class="action-btn danger" title="删除用户" @click="$emit('delete', user)">
            <Trash2 :size="16" />
          </button>
        </div>
      </div>

      <Transition name="modules">
        <div v-if="expandedId === user.id" class="modules-panel">
          <div class="modules-divider" />
          <ModuleToggles
            :modules="user.modules"
            @change="(moduleId: string, enabled: boolean) => $emit('moduleChange', user.id, moduleId, enabled)"
          />
          <div class="feature-toggles">
            <div class="toggles-label">功能设置</div>
            <div class="toggle-grid">
              <div
                class="toggle-item"
                :class="{ enabled: user.multiWordbookEnabled }"
                @click="$emit('vocabSettingChange', user.id, 'multi_wordbook_enabled', user.multiWordbookEnabled ? 'false' : 'true')"
              >
                <span class="toggle-name">多词汇本模式</span>
                <button
                  class="toggle-switch"
                  :class="{ active: user.multiWordbookEnabled }"
                  role="switch"
                  :aria-checked="user.multiWordbookEnabled"
                  @click.stop="$emit('vocabSettingChange', user.id, 'multi_wordbook_enabled', user.multiWordbookEnabled ? 'false' : 'true')"
                >
                  <span class="toggle-knob" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </div>

    <div v-if="users.length === 0" class="empty">
      <span class="empty-icon">-</span>
      <span>暂无用户</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ChevronDown, KeyRound, Trash2 } from 'lucide-vue-next';
import ModuleToggles from './ModuleToggles.vue';

defineProps<{
  users: Array<{
    id: number;
    username: string;
    role: string;
    email: string | null;
    createdAt: number;
    dbSize: number | null;
    modules: Array<{ moduleId: string; enabled: boolean }>;
    multiWordbookEnabled: boolean;
  }>;
  expandedId: number | null;
}>();

const emit = defineEmits<{
  toggleExpand: [id: number];
  delete: [user: any];
  resetPassword: [user: any];
  moduleChange: [userId: number, moduleId: string, enabled: boolean];
  vocabSettingChange: [userId: number, key: string, value: string];
  emailChange: [userId: number, email: string];
}>();

const editingEmailUserId = ref<number | null>(null);
const editingEmailValue = ref('');
const emailInputRef = ref<HTMLInputElement | null>(null);

function startEditEmail(user: { id: number; email: string | null }) {
  editingEmailUserId.value = user.id;
  editingEmailValue.value = user.email || '';
  nextTick(() => {
    emailInputRef.value?.focus();
  });
}

function cancelEditEmail() {
  editingEmailUserId.value = null;
  editingEmailValue.value = '';
}

function saveEmail(userId: number) {
  const email = editingEmailValue.value.trim();
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    emit('emailChange', userId, email);
  }
  editingEmailUserId.value = null;
  editingEmailValue.value = '';
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('zh-CN');
}

function formatSize(bytes: number | null): string {
  if (bytes == null) return '--';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
</script>

<style scoped>
.user-list {
  display: flex;
  flex-direction: column;
}

.user-card {
  border-bottom: 1px solid var(--color-border);
  transition: background var(--transition-fast);
}

.user-card:last-child {
  border-bottom: none;
}

.user-card:hover {
  background: var(--color-bg-hover);
}

.user-card.expanded {
  background: var(--color-bg-sidebar);
}

.user-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md);
  gap: var(--spacing-md);
}

/* User identity */
.user-identity {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-width: 160px;
}

.user-avatar {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-accent);
  color: var(--color-accent-inverse);
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 700;
  font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
  flex-shrink: 0;
}

.user-meta {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.username {
  font-weight: 600;
  font-size: 14px;
  color: var(--color-text-primary);
}

.role-badge {
  display: inline-flex;
  align-items: center;
  padding: 1px 8px;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.3px;
  border-radius: 2px;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  background: transparent;
}

.role-badge.admin {
  background: var(--color-accent);
  color: var(--color-accent-inverse);
  border-color: var(--color-accent);
  font-weight: 600;
}

/* Stats */
.user-stats {
  display: flex;
  gap: var(--spacing-lg);
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.stat-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--color-text-tertiary);
  font-weight: 500;
}

.stat-value {
  font-size: 13px;
  color: var(--color-text-primary);
}

.mono {
  font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
  letter-spacing: -0.2px;
}

/* Email */
.stat-email {
  min-width: 140px;
}

.email-display {
  cursor: pointer;
  transition: color var(--transition-fast);
}

.email-display:hover {
  color: var(--color-accent);
}

.email-display.placeholder {
  color: var(--color-text-tertiary);
  font-style: italic;
}

.email-input {
  font-size: 13px;
  padding: 1px 4px;
  border: none;
  border-bottom: 1px solid var(--color-accent);
  background: transparent;
  color: var(--color-text-primary);
  outline: none;
  width: 160px;
  font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
  letter-spacing: -0.2px;
}

/* Actions */
.user-actions {
  display: flex;
  gap: 4px;
}

.action-btn {
  width: 32px;
  height: 32px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
}

.action-btn:hover {
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  border-color: var(--color-text-tertiary);
}

.action-btn.active {
  background: var(--color-accent);
  color: var(--color-accent-inverse);
  border-color: var(--color-accent);
}

.action-btn.danger:hover {
  color: var(--color-danger);
  border-color: var(--color-danger);
  background: var(--color-bg-primary);
}

.expand-icon {
  transition: transform 0.25s ease;
}

.expand-icon.rotated {
  transform: rotate(180deg);
}

/* Modules panel */
.modules-panel {
  padding: 0 var(--spacing-md) var(--spacing-md);
}

.modules-divider {
  height: 1px;
  background: linear-gradient(
    to right,
    transparent,
    var(--color-border),
    var(--color-border),
    transparent
  );
  margin-bottom: var(--spacing-md);
}

/* Feature toggles */
.feature-toggles {
  margin-top: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.toggles-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--color-text-tertiary);
  font-weight: 600;
}

.toggle-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: var(--spacing-xs);
}

.toggle-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-sm) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  background: var(--color-bg-primary);
}

.toggle-item:hover {
  border-color: var(--color-text-tertiary);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
}

.toggle-item.enabled {
  border-color: var(--color-accent);
  background: var(--color-bg-primary);
}

.toggle-name {
  font-size: 13px;
  color: var(--color-text-primary);
  font-weight: 500;
}

.toggle-switch {
  position: relative;
  width: 36px;
  height: 20px;
  background: var(--color-border);
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.25s ease;
  flex-shrink: 0;
  padding: 0;
}

.toggle-switch.active {
  background: var(--color-accent);
}

.toggle-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  background: var(--color-bg-primary);
  border-radius: 50%;
  transition: transform 0.25s ease;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
}

.toggle-switch.active .toggle-knob {
  transform: translateX(16px);
}

/* Modules transition */
.modules-enter-active,
.modules-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.modules-enter-from,
.modules-leave-to {
  opacity: 0;
  max-height: 0;
  padding-bottom: 0;
}

.modules-enter-to,
.modules-leave-from {
  opacity: 1;
  max-height: 300px;
}

/* Empty state */
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xl);
  color: var(--color-text-tertiary);
  font-size: 13px;
}

.empty-icon {
  font-size: 24px;
  font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
}

/* Mobile */
@media (max-width: 768px) {
  .user-row {
    flex-wrap: wrap;
    gap: var(--spacing-sm);
  }

  .user-identity {
    min-width: auto;
    flex: 1;
  }

  .user-stats {
    order: 3;
    width: 100%;
    gap: var(--spacing-md);
    padding-left: 40px;
  }

  .user-actions {
    order: 2;
  }
}
</style>
