<template>
  <BaseModal :open="open" title="用户管理" @close="$emit('close')">
    <!-- 用户列表 -->
    <div class="userList">
      <div
        v-for="user in store.users"
        :key="user.id"
        class="userItem"
        :class="{ active: user.id === store.currentUserId }"
      >
        <span class="userName">{{ user.nickname }}</span>
        <div class="userActions">
          <button
            v-if="user.id !== store.currentUserId"
            class="userBtn"
            @click="handleSwitch(user.id)"
          >
            切换
          </button>
          <span v-else class="currentTag">当前</span>
          <button
            class="userBtn userBtnDanger"
            :disabled="store.users.length <= 1"
            @click="confirmDelete(user)"
          >
            删除
          </button>
        </div>
      </div>
    </div>

    <!-- 创建新用户 -->
    <div class="createSection">
      <input
        v-model="newName"
        type="text"
        class="nameInput"
        placeholder="新用户昵称"
        maxlength="20"
        @keyup.enter="handleCreate"
      />
      <button
        class="createBtn"
        :disabled="!newName.trim() || creating"
        @click="handleCreate"
      >
        创建
      </button>
    </div>

    <!-- 删除确认 -->
    <ConfirmDialog
      :open="!!deletingUser"
      title="删除用户"
      :message="`确定要删除用户「${deletingUser?.nickname}」吗？该用户的所有学习进度将被删除。`"
      confirm-text="删除"
      :danger="true"
      @confirm="handleDelete"
      @cancel="deletingUser = null"
    />
  </BaseModal>
</template>

<script setup lang="ts">
import type { User } from '../types';

defineProps<{ open: boolean }>();
defineEmits<{ close: [] }>();

const store = useVocabStore();
const newName = ref('');
const creating = ref(false);
const deletingUser = ref<User | null>(null);

async function handleCreate() {
  const name = newName.value.trim();
  if (!name || creating.value) return;
  creating.value = true;
  try {
    await store.createUser(name);
    newName.value = '';
  } finally {
    creating.value = false;
  }
}

async function handleSwitch(userId: string) {
  await store.switchUser(userId);
}

function confirmDelete(user: User) {
  deletingUser.value = user;
}

async function handleDelete() {
  if (!deletingUser.value) return;
  await store.deleteUser(deletingUser.value.id);
  deletingUser.value = null;
}
</script>

<style scoped>
.userList {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  margin-bottom: var(--spacing-md);
}

.userItem {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.userItem.active {
  border-color: var(--color-accent);
}

.userName {
  font-size: 14px;
  color: var(--color-text-primary);
}

.userActions {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.currentTag {
  font-size: 12px;
  color: var(--color-accent);
  padding: 2px var(--spacing-sm);
}

.userBtn {
  padding: 2px var(--spacing-sm);
  font-size: 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
}

.userBtn:hover:not(:disabled) {
  background-color: var(--color-bg-hover);
}

.userBtn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.userBtnDanger:hover:not(:disabled) {
  color: #DC2626;
  border-color: #DC2626;
  background-color: #FEF2F2;
}

.createSection {
  display: flex;
  gap: var(--spacing-sm);
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--color-border);
}

.nameInput {
  flex: 1;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  outline: none;
}

.nameInput:focus {
  border-color: var(--color-accent);
}

.createBtn {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-sm);
  background-color: var(--color-accent);
  color: var(--color-accent-inverse);
  font-size: 13px;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}

.createBtn:hover:not(:disabled) {
  opacity: 0.85;
}

.createBtn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
