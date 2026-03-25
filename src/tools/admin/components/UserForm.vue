<template>
  <Transition name="modal">
    <div class="modal-overlay" @click.self="$emit('close')">
      <div class="modal">
        <div class="modal-header">
          <h3>{{ isResetPassword ? '重置密码' : '添加用户' }}</h3>
          <span v-if="isResetPassword" class="modal-target mono">{{ user?.username }}</span>
        </div>

        <form @submit.prevent="submit">
          <template v-if="!isResetPassword">
            <div class="field">
              <label class="field-label">用户名</label>
              <input
                v-model="form.username"
                type="text"
                class="field-input"
                placeholder="小写字母、数字、下划线"
                required
                autocomplete="off"
              />
              <div class="field-line" />
            </div>
            <div class="field">
              <label class="field-label">邮箱</label>
              <input
                v-model="form.email"
                type="email"
                class="field-input"
                placeholder="user@example.com"
                required
                autocomplete="off"
              />
              <div class="field-line" />
            </div>
            <div class="field">
              <label class="field-label">角色</label>
              <select v-model="form.role" class="field-input">
                <option value="user">普通用户</option>
                <option value="admin">管理员</option>
              </select>
              <div class="field-line" />
            </div>
          </template>

          <div class="field">
            <label class="field-label">{{ isResetPassword ? '新密码' : '密码' }}</label>
            <input
              v-model="form.password"
              type="password"
              class="field-input"
              placeholder="至少4位"
              required
              autocomplete="new-password"
            />
            <div class="field-line" />
          </div>

          <div v-if="error" class="form-error">{{ error }}</div>

          <div class="form-actions">
            <button type="button" class="btn-cancel" @click="$emit('close')">取消</button>
            <button type="submit" class="btn-submit" :disabled="submitting">
              <span v-if="submitting" class="spinner" />
              {{ submitting ? '处理中...' : (isResetPassword ? '重置' : '创建') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Transition>
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
  email: '',
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
          email: form.email,
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
/* Overlay */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

/* Modal */
.modal {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-sm);
  padding: var(--spacing-lg);
  width: 420px;
  max-width: 90vw;
  box-shadow:
    0 0 0 1px var(--color-border),
    0 16px 48px rgba(0, 0, 0, 0.2);
}

/* Header */
.modal-header {
  display: flex;
  align-items: baseline;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-lg);
  padding-bottom: var(--spacing-sm);
  border-bottom: 1px solid var(--color-border);
}

h3 {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text-primary);
  letter-spacing: -0.2px;
}

.modal-target {
  font-size: 14px;
  color: var(--color-text-secondary);
}

.mono {
  font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
}

/* Fields */
.field {
  margin-bottom: var(--spacing-md);
  position: relative;
}

.field-label {
  display: block;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--color-text-tertiary);
  font-weight: 600;
  margin-bottom: var(--spacing-xs);
}

.field-input {
  width: 100%;
  padding: var(--spacing-sm) 0;
  border: none;
  border-bottom: 1px solid var(--color-border);
  border-radius: 0;
  font-size: 14px;
  background: transparent;
  color: var(--color-text-primary);
  outline: none;
  transition: border-color var(--transition-fast);
}

.field-input:focus {
  border-bottom-color: var(--color-accent);
}

.field-input::placeholder {
  color: var(--color-text-tertiary);
}

.field-line {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 0;
  height: 2px;
  background: var(--color-accent);
  transition: width 0.3s ease;
}

.field-input:focus ~ .field-line {
  width: 100%;
}

select.field-input {
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%23666' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0 center;
}

/* Error */
.form-error {
  color: var(--color-danger);
  font-size: 13px;
  margin-bottom: var(--spacing-sm);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-left: 2px solid var(--color-danger);
}

/* Actions */
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-lg);
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--color-border);
}

.btn-cancel {
  padding: var(--spacing-sm) var(--spacing-md);
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 13px;
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
}

.btn-cancel:hover {
  border-color: var(--color-text-tertiary);
  color: var(--color-text-primary);
}

.btn-submit {
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
}

.btn-submit:hover:not(:disabled) {
  opacity: 0.85;
}

.btn-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Spinner */
.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--color-accent-inverse);
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Modal transition */
.modal-enter-active {
  transition: all 0.25s ease;
}

.modal-leave-active {
  transition: all 0.2s ease;
}

.modal-enter-from .modal-overlay,
.modal-leave-to .modal-overlay {
  opacity: 0;
}

.modal-enter-from .modal {
  opacity: 0;
  transform: translateY(12px);
}

.modal-leave-to .modal {
  opacity: 0;
  transform: translateY(8px);
}

/* Mobile */
@media (max-width: 768px) {
  .modal {
    width: 100%;
    max-width: calc(100vw - var(--spacing-lg));
  }
}
</style>
