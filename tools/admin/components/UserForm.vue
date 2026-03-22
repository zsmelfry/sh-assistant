<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal">
      <h3>{{ isResetPassword ? `重置密码：${user?.username}` : '添加用户' }}</h3>

      <form @submit.prevent="submit">
        <template v-if="!isResetPassword">
          <label>
            <span>用户名</span>
            <input v-model="form.username" type="text" placeholder="小写字母、数字、下划线" required />
          </label>
          <label>
            <span>角色</span>
            <select v-model="form.role">
              <option value="user">普通用户</option>
              <option value="admin">管理员</option>
            </select>
          </label>
        </template>

        <label>
          <span>{{ isResetPassword ? '新密码' : '密码' }}</span>
          <input v-model="form.password" type="password" placeholder="至少4位" required />
        </label>

        <div v-if="error" class="error">{{ error }}</div>

        <div class="form-actions">
          <button type="button" class="btn-cancel" @click="$emit('close')">取消</button>
          <button type="submit" class="btn-primary" :disabled="submitting">
            {{ submitting ? '处理中...' : (isResetPassword ? '重置' : '创建') }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  mode?: 'reset-password';
  user?: { id: number; username: string } | null;
}>();

const emit = defineEmits<{
  close: [];
  created: [];
}>();

const isResetPassword = computed(() => props.mode === 'reset-password');

const form = reactive({
  username: '',
  password: '',
  role: 'user',
});

const error = ref('');
const submitting = ref(false);

async function submit() {
  error.value = '';
  submitting.value = true;

  try {
    if (isResetPassword.value && props.user) {
      await $fetch(`/api/admin/users/${props.user.id}/reset-password`, {
        method: 'POST',
        body: { password: form.password },
      });
    } else {
      await $fetch('/api/admin/users', {
        method: 'POST',
        body: {
          username: form.username,
          password: form.password,
          role: form.role,
        },
      });
    }
    emit('created');
  } catch (e: any) {
    error.value = e?.data?.message || '操作失败';
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--color-bg);
  border-radius: var(--radius-md);
  padding: var(--spacing-lg);
  width: 400px;
  max-width: 90vw;
  border: 1px solid var(--color-border);
}

h3 {
  margin-bottom: var(--spacing-md);
  font-size: 16px;
}

label {
  display: block;
  margin-bottom: var(--spacing-sm);
}

label span {
  display: block;
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
}

input, select {
  width: 100%;
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  background: var(--color-bg);
  color: var(--color-text);
}

.error {
  color: var(--color-danger, #c00);
  font-size: 13px;
  margin-top: var(--spacing-sm);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-md);
}

.btn-primary {
  padding: var(--spacing-xs) var(--spacing-md);
  background: var(--color-text);
  color: var(--color-bg);
  border: 1px solid var(--color-text);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-cancel {
  padding: var(--spacing-xs) var(--spacing-md);
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 14px;
  color: var(--color-text);
}
</style>
