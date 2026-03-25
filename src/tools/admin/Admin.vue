<template>
  <div class="admin-panel">
    <header class="admin-header">
      <div class="header-content">
        <div class="header-title-group">
          <div class="header-icon">
            <Shield :size="20" />
          </div>
          <div>
            <h2>控制台</h2>
            <p class="header-subtitle">用户管理</p>
          </div>
        </div>
        <button class="btn-add-user" @click="showCreateForm = true">
          <UserPlus :size="16" />
          <span>邀请用户</span>
        </button>
      </div>
      <div class="header-line" />
    </header>

    <div class="admin-body">
      <section class="admin-section">
        <div class="section-card">
          <div class="section-card-header">
            <div class="section-title-row">
              <div class="section-icon">
                <Users :size="16" />
              </div>
              <h3>用户列表</h3>
            </div>
            <span class="user-count" v-if="!loading">{{ userList.length }} 用户</span>
          </div>

          <div class="section-card-body">
            <div v-if="loading" class="status-message">
              <span class="pulse-dot" />
              <span>加载中...</span>
            </div>
            <div v-else-if="error" class="status-message error">{{ error }}</div>

            <UserList
              v-else
              :users="userList"
              :expanded-id="expandedUserId"
              :pending-invites="pendingInvites"
              @toggle-expand="toggleExpand"
              @delete="confirmDelete"
              @reset-password="openResetPassword"
              @force-reset="handleForceReset"
              @module-change="handleModuleChange"
              @vocab-setting-change="handleVocabSettingChange"
              @email-change="handleEmailChange"
              @invite-changed="fetchPendingInvites"
            />
          </div>
        </div>
      </section>
    </div>

    <UserForm
      v-if="showCreateForm"
      @close="showCreateForm = false"
      @created="onUserCreated"
    />
  </div>
</template>

<script setup lang="ts">
import { Shield, Users, UserPlus } from 'lucide-vue-next';
import UserList from './components/UserList.vue';
import UserForm from './components/UserForm.vue';
interface AdminUser {
  id: number;
  username: string;
  role: string;
  email: string | null;
  createdAt: number;
  dbSize: number | null;
  modules: Array<{ moduleId: string; enabled: boolean }>;
  multiWordbookEnabled: boolean;
}

interface PendingInvite {
  id: number;
  email: string;
  role: string | null;
  expiresAt: number;
  createdAt: number;
}

const userList = ref<AdminUser[]>([]);
const pendingInvites = ref<PendingInvite[]>([]);
const loading = ref(true);
const error = ref('');
const showCreateForm = ref(false);
const expandedUserId = ref<number | null>(null);

async function fetchUsers() {
  loading.value = true;
  error.value = '';
  try {
    userList.value = await $fetch<AdminUser[]>('/api/admin/users');
  } catch (e: any) {
    error.value = e?.data?.message || '加载用户列表失败';
  } finally {
    loading.value = false;
  }
}

function toggleExpand(id: number) {
  expandedUserId.value = expandedUserId.value === id ? null : id;
}

async function confirmDelete(user: AdminUser) {
  if (!confirm(`确定删除用户 "${user.username}"？其数据将被归档。`)) return;
  try {
    await $fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' });
    await fetchUsers();
  } catch (e: any) {
    alert(e?.data?.message || '删除失败');
  }
}

function openResetPassword(_user: AdminUser) {
  // Legacy — force-reset is now handled inline by UserList
}

function handleForceReset(_user: AdminUser) {
  // Force reset is handled directly in UserList component
}

async function fetchPendingInvites() {
  try {
    pendingInvites.value = await $fetch<PendingInvite[]>('/api/admin/invites');
  } catch {
    // Non-critical — don't block the UI
    pendingInvites.value = [];
  }
}

async function handleModuleChange(userId: number, moduleId: string, enabled: boolean) {
  try {
    await $fetch(`/api/admin/users/${userId}/modules`, {
      method: 'PUT',
      body: { modules: [{ moduleId, enabled }] },
    });
    await fetchUsers();
  } catch (e: any) {
    alert(e?.data?.message || '更新权限失败');
  }
}

async function handleEmailChange(userId: number, email: string) {
  try {
    await $fetch(`/api/admin/users/${userId}/email`, {
      method: 'PUT',
      body: { email },
    });
    await fetchUsers();
  } catch (e: any) {
    alert(e?.data?.message || '更新邮箱失败');
  }
}

async function handleVocabSettingChange(userId: number, key: string, value: string) {
  try {
    await $fetch(`/api/admin/users/${userId}/vocab-settings`, {
      method: 'PUT',
      body: { key, value },
    });
    await fetchUsers();
  } catch (e: any) {
    alert(e?.data?.message || '更新设置失败');
  }
}

function onUserCreated() {
  showCreateForm.value = false;
  fetchUsers();
  fetchPendingInvites();
}

onMounted(() => {
  fetchUsers();
  fetchPendingInvites();
});
</script>

<style scoped>
.admin-panel {
  max-width: 960px;
  margin: 0 auto;
  padding: 0 var(--spacing-md);
}

/* Header */
.admin-header {
  margin-bottom: var(--spacing-xl);
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md) 0;
}

.header-title-group {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: var(--color-accent);
  color: var(--color-accent-inverse);
  border-radius: var(--radius-sm);
}

h2 {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.3px;
  color: var(--color-text-primary);
  line-height: 1.2;
}

.header-subtitle {
  font-size: 12px;
  color: var(--color-text-tertiary);
  font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
  letter-spacing: 0.5px;
  margin-top: 2px;
}

.header-line {
  height: 2px;
  background: linear-gradient(
    to right,
    var(--color-accent),
    var(--color-accent),
    var(--color-border),
    transparent
  );
}

/* Add User Button */
.btn-add-user {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-accent);
  color: var(--color-accent-inverse);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all var(--transition-fast);
  letter-spacing: 0.3px;
}

.btn-add-user:hover {
  opacity: 0.85;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* Body */
.admin-body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.admin-section {
  width: 100%;
}

/* Section card */
.section-card {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.section-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--color-border);
}

.section-title-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.section-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: var(--color-accent);
  color: var(--color-accent-inverse);
  border-radius: var(--radius-sm);
}

h3 {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: var(--color-text-primary);
}

.user-count {
  font-size: 12px;
  font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
  color: var(--color-text-tertiary);
  padding: 2px var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.section-card-body {
  padding: 0;
}

/* Status messages */
.status-message {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xl);
  color: var(--color-text-secondary);
  font-size: 13px;
}

.status-message.error {
  color: var(--color-danger);
}

.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-text-tertiary);
  animation: pulse 1.2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

/* Mobile */
@media (max-width: 768px) {
  .admin-panel {
    padding: 0 var(--spacing-sm);
  }

  .header-content {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-md);
  }

  .btn-add-user {
    width: 100%;
    justify-content: center;
  }

  h2 {
    font-size: 18px;
  }
}
</style>
