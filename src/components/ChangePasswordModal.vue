<template>
  <Transition name="modal">
    <div class="modal-overlay" @click.self="$emit('close')">
      <div class="modal">
        <div class="modal-header">
          <h3>修改密码</h3>
        </div>

        <div v-if="success" class="success-state">
          <p class="success-msg">密码修改成功</p>
          <p class="success-hint">其他设备上的登录将会失效。</p>
          <button class="btn-submit" @click="$emit('close')">关闭</button>
        </div>

        <form v-else @submit.prevent="submit">
          <div class="field">
            <label class="field-label">当前密码</label>
            <input
              v-model="form.currentPassword"
              type="password"
              class="field-input"
              autocomplete="current-password"
              required
              :disabled="submitting"
            />
            <div class="field-line" />
          </div>

          <div class="field">
            <label class="field-label">新密码</label>
            <input
              v-model="form.newPassword"
              type="password"
              class="field-input"
              autocomplete="new-password"
              required
              :disabled="submitting"
            />
            <div class="field-line" />
            <div class="password-strength">
              <div
                class="strength-bar"
                :class="passwordStrengthClass"
              />
              <span class="strength-hint">{{ passwordStrengthText }}</span>
            </div>
          </div>

          <div class="field">
            <label class="field-label">确认新密码</label>
            <input
              v-model="form.confirmPassword"
              type="password"
              class="field-input"
              autocomplete="new-password"
              required
              :disabled="submitting"
            />
            <div class="field-line" />
          </div>

          <div v-if="error" class="form-error">{{ error }}</div>

          <div class="form-actions">
            <button type="button" class="btn-cancel" @click="$emit('close')" :disabled="submitting">取消</button>
            <button type="submit" class="btn-submit" :disabled="submitting || !canSubmit">
              <span v-if="submitting" class="spinner" />
              {{ submitting ? '处理中...' : '修改密码' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { PASSWORD_MIN_LENGTH } from '~/utils/password-rules';

defineEmits<{
  close: [];
}>();

const { changePassword } = useAuth();

const form = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
});

const error = ref('');
const submitting = ref(false);
const success = ref(false);

const passwordStrengthClass = computed(() => {
  const len = form.newPassword.length;
  if (len === 0) return '';
  if (len < PASSWORD_MIN_LENGTH) return 'strength-weak';
  if (len < 12) return 'strength-fair';
  return 'strength-strong';
});

const passwordStrengthText = computed(() => {
  const len = form.newPassword.length;
  if (len === 0) return `至少 ${PASSWORD_MIN_LENGTH} 个字符`;
  if (len < PASSWORD_MIN_LENGTH) return `还需 ${PASSWORD_MIN_LENGTH - len} 个字符`;
  if (len < 12) return '强度一般';
  return '强度良好';
});

const canSubmit = computed(() => {
  return form.currentPassword.length > 0
    && form.newPassword.length >= PASSWORD_MIN_LENGTH
    && form.newPassword === form.confirmPassword;
});

async function submit() {
  if (!canSubmit.value) return;

  if (form.newPassword !== form.confirmPassword) {
    error.value = '两次输入的新密码不一致';
    return;
  }

  error.value = '';
  submitting.value = true;

  try {
    await changePassword(form.currentPassword, form.newPassword);
    success.value = true;
  } catch (e: any) {
    error.value = e?.data?.message || '修改密码失败';
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

.field-input:disabled {
  opacity: 0.5;
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

/* Password strength */
.password-strength {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-xs);
}

.strength-bar {
  height: 3px;
  border-radius: 2px;
  flex: 1;
  background-color: var(--color-border);
  transition: background-color var(--transition-fast);
}

.strength-bar.strength-weak {
  background-color: var(--color-danger);
}

.strength-bar.strength-fair {
  background-color: var(--color-text-secondary);
}

.strength-bar.strength-strong {
  background-color: var(--color-accent);
}

.strength-hint {
  font-size: 12px;
  color: var(--color-text-tertiary);
  white-space: nowrap;
}

/* Error */
.form-error {
  color: var(--color-danger);
  font-size: 13px;
  margin-bottom: var(--spacing-sm);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-left: 2px solid var(--color-danger);
}

/* Success */
.success-state {
  text-align: center;
  padding: var(--spacing-lg) 0;
}

.success-msg {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-xs);
}

.success-hint {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-lg);
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

.btn-cancel:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal {
  transform: translateY(12px);
}

.modal-leave-to .modal {
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
