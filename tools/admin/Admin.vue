<template>
  <div class="admin-panel">
    <div class="admin-header">
      <h2>用户管理</h2>
      <button class="btn-primary" @click="showCreateForm = true">添加用户</button>
    </div>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <UserList
      v-else
      :users="userList"
      :expanded-id="expandedUserId"
      @toggle-expand="toggleExpand"
      @delete="confirmDelete"
      @reset-password="openResetPassword"
      @module-change="handleModuleChange"
    />

    <UserForm
      v-if="showCreateForm"
      @close="showCreateForm = false"
      @created="onUserCreated"
    />

    <UserForm
      v-if="resetPasswordUser"
      mode="reset-password"
      :user="resetPasswordUser"
      @close="resetPasswordUser = null"
      @created="onPasswordReset"
    />
  </div>
</template>

<script setup lang="ts">
import UserList from './components/UserList.vue';
import UserForm from './components/UserForm.vue';

interface AdminUser {
  id: number;
  username: string;
  role: string;
  createdAt: number;
  dbSize: number | null;
  modules: Array<{ moduleId: string; enabled: boolean }>;
}

const { getAuthHeaders } = useAuth();
const userList = ref<AdminUser[]>([]);
const loading = ref(true);
const error = ref('');
const showCreateForm = ref(false);
const expandedUserId = ref<number | null>(null);
const resetPasswordUser = ref<AdminUser | null>(null);

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

function openResetPassword(user: AdminUser) {
  resetPasswordUser.value = user;
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

function onUserCreated() {
  showCreateForm.value = false;
  fetchUsers();
}

function onPasswordReset() {
  resetPasswordUser.value = null;
}

onMounted(fetchUsers);
</script>

<style scoped>
.admin-panel {
  max-width: 900px;
  margin: 0 auto;
}

.admin-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-lg);
}

.admin-header h2 {
  font-size: 20px;
  font-weight: 600;
}

.btn-primary {
  padding: var(--spacing-xs) var(--spacing-md);
  background: var(--color-accent);
  color: var(--color-bg);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 14px;
}

.btn-primary:hover {
  opacity: 0.85;
}

.loading,
.error {
  text-align: center;
  padding: var(--spacing-xl);
  color: var(--color-text-secondary);
}

.error {
  color: var(--color-danger, #c00);
}
</style>
