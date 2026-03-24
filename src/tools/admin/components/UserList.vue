<template>
  <div class="user-list">
    <table>
      <thead>
        <tr>
          <th>用户名</th>
          <th>角色</th>
          <th>创建时间</th>
          <th>数据大小</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="user in users" :key="user.id">
          <tr :class="{ expanded: expandedId === user.id }">
            <td class="username">{{ user.username }}</td>
            <td>
              <span class="role-badge" :class="user.role">{{ user.role === 'admin' ? '管理员' : '普通用户' }}</span>
            </td>
            <td>{{ formatDate(user.createdAt) }}</td>
            <td>{{ formatSize(user.dbSize) }}</td>
            <td class="actions">
              <button class="action-btn" title="模块权限" @click="$emit('toggleExpand', user.id)">
                <ChevronDown :size="16" :class="{ rotated: expandedId === user.id }" />
              </button>
              <button class="action-btn" title="重置密码" @click="$emit('resetPassword', user)">
                <KeyRound :size="16" />
              </button>
              <button class="action-btn danger" title="删除用户" @click="$emit('delete', user)">
                <Trash2 :size="16" />
              </button>
            </td>
          </tr>
          <tr v-if="expandedId === user.id" class="modules-row">
            <td colspan="5">
              <ModuleToggles
                :modules="user.modules"
                @change="(moduleId: string, enabled: boolean) => $emit('moduleChange', user.id, moduleId, enabled)"
              />
            </td>
          </tr>
        </template>
      </tbody>
    </table>

    <div v-if="users.length === 0" class="empty">暂无用户</div>
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
    createdAt: number;
    dbSize: number | null;
    modules: Array<{ moduleId: string; enabled: boolean }>;
  }>;
  expandedId: number | null;
}>();

defineEmits<{
  toggleExpand: [id: number];
  delete: [user: any];
  resetPassword: [user: any];
  moduleChange: [userId: number, moduleId: string, enabled: boolean];
}>();

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('zh-CN');
}

function formatSize(bytes: number | null): string {
  if (bytes == null) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
</script>

<style scoped>
table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  padding: var(--spacing-sm) var(--spacing-md);
  text-align: left;
  border-bottom: 1px solid var(--color-border);
}

th {
  font-weight: 600;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.username {
  font-weight: 500;
}

.role-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  border: 1px solid var(--color-border);
}

.role-badge.admin {
  font-weight: 600;
}

.actions {
  display: flex;
  gap: var(--spacing-xs);
}

.action-btn {
  padding: 4px;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  color: var(--color-text);
}

.action-btn:hover {
  background: var(--color-bg-secondary);
}

.action-btn.danger:hover {
  color: var(--color-danger, #c00);
  border-color: var(--color-danger, #c00);
}

.rotated {
  transform: rotate(180deg);
  transition: transform 0.2s;
}

.modules-row td {
  padding: var(--spacing-sm) var(--spacing-md) var(--spacing-md);
  background: var(--color-bg-secondary);
}

.expanded {
  background: var(--color-bg-secondary);
}

.empty {
  text-align: center;
  padding: var(--spacing-xl);
  color: var(--color-text-secondary);
}
</style>
