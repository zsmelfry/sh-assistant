<template>
  <div class="login-card">
    <h1 class="login-title">个人助手</h1>

    <!-- Loading state -->
    <div v-if="verifying" class="login-subtitle">
      正在验证邀请链接...
    </div>

    <!-- Invalid token -->
    <div v-else-if="!tokenValid" class="invalid-state">
      <p class="error-msg">{{ invalidMessage }}</p>
      <p class="login-subtitle">如有疑问，请联系管理员。</p>
      <NuxtLink to="/login" class="back-link">返回登录</NuxtLink>
    </div>

    <!-- Valid token — show form -->
    <template v-else>
      <p class="login-subtitle">设置您的账户</p>
      <p class="invite-email">邀请邮箱：{{ tokenEmail }}</p>

      <form class="login-form" @submit.prevent="handleSubmit">
        <div class="field">
          <label class="field-label" for="username">用户名</label>
          <input
            id="username"
            v-model="username"
            type="text"
            class="field-input"
            autocomplete="username"
            placeholder="小写字母、数字、下划线，3-30位"
            :disabled="submitting"
            @input="clearError"
          />
        </div>

        <div class="field">
          <label class="field-label" for="password">密码</label>
          <input
            id="password"
            v-model="password"
            type="password"
            class="field-input"
            autocomplete="new-password"
            :disabled="submitting"
            @input="clearError"
          />
          <div class="password-strength">
            <div
              class="strength-bar"
              :class="passwordStrengthClass"
            />
            <span class="strength-hint">{{ passwordStrengthText }}</span>
          </div>
        </div>

        <div class="field">
          <label class="field-label" for="confirmPassword">确认密码</label>
          <input
            id="confirmPassword"
            v-model="confirmPassword"
            type="password"
            class="field-input"
            autocomplete="new-password"
            :disabled="submitting"
            @input="clearError"
          />
        </div>

        <p v-if="error" class="error-msg">{{ error }}</p>

        <button
          type="submit"
          class="submit-btn"
          :disabled="submitting || !canSubmit"
        >
          {{ submitting ? '创建中...' : '创建账户' }}
        </button>
      </form>
    </template>
  </div>
</template>

<script setup lang="ts">
import { PASSWORD_MIN_LENGTH } from '~/utils/password-rules';
import { registerSkillTools } from '~/plugins/tools.client';

definePageMeta({
  layout: 'auth',
});

const route = useRoute();
const { login } = useAuth();

// Token verification state
const verifying = ref(true);
const tokenValid = ref(false);
const tokenEmail = ref('');
const invalidMessage = ref('');

// Form state
const username = ref('');
const password = ref('');
const confirmPassword = ref('');
const error = ref('');
const submitting = ref(false);

// Password strength
const passwordStrengthClass = computed(() => {
  const len = password.value.length;
  if (len === 0) return '';
  if (len < PASSWORD_MIN_LENGTH) return 'strength-weak';
  if (len < 12) return 'strength-fair';
  return 'strength-strong';
});

const passwordStrengthText = computed(() => {
  const len = password.value.length;
  if (len === 0) return `至少 ${PASSWORD_MIN_LENGTH} 个字符`;
  if (len < PASSWORD_MIN_LENGTH) return `还需 ${PASSWORD_MIN_LENGTH - len} 个字符`;
  if (len < 12) return '强度一般';
  return '强度良好';
});

const canSubmit = computed(() => {
  return username.value.trim().length >= 3
    && password.value.length >= PASSWORD_MIN_LENGTH
    && password.value === confirmPassword.value;
});

function clearError() {
  error.value = '';
}

// Verify token on mount
onMounted(async () => {
  const token = route.params.token as string;
  if (!token) {
    tokenValid.value = false;
    invalidMessage.value = '邀请链接无效';
    verifying.value = false;
    return;
  }

  try {
    const res = await $fetch<{ valid: boolean; email?: string; reason?: string }>('/api/auth/verify-token', {
      method: 'POST',
      body: { token, type: 'invite' },
    });

    if (res.valid && res.email) {
      tokenValid.value = true;
      tokenEmail.value = res.email;
    } else {
      tokenValid.value = false;
      const reasonMap: Record<string, string> = {
        expired: '此邀请链接已过期',
        used: '此邀请链接已被使用',
        invalid: '此邀请链接无效',
      };
      invalidMessage.value = reasonMap[res.reason || ''] || '此邀请链接无效';
    }
  } catch {
    tokenValid.value = false;
    invalidMessage.value = '验证邀请链接时出错';
  } finally {
    verifying.value = false;
  }
});

async function handleSubmit() {
  if (!canSubmit.value) return;

  // Client-side validation
  if (password.value !== confirmPassword.value) {
    error.value = '两次输入的密码不一致';
    return;
  }

  submitting.value = true;
  error.value = '';

  try {
    const token = route.params.token as string;
    const res = await $fetch<{ token: string; role: string; enabledModules: string[] }>('/api/auth/accept-invite', {
      method: 'POST',
      body: {
        token,
        username: username.value.trim(),
        password: password.value,
      },
    });

    // Store auth and redirect
    const { setPermissions } = useModulePermissions();
    localStorage.setItem('auth_token', res.token);
    setPermissions(res.enabledModules || [], res.role || 'user');

    // Re-initialize auth state so the app picks up the new token
    // We need to manually trigger since useAuth().init() only runs once
    // Simplest approach: navigate and let the auth plugin re-init
    await registerSkillTools();
    window.location.href = '/';
  } catch (e: unknown) {
    error.value = extractErrorMessage(e, '创建账户失败，请重试');
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.login-card {
  width: 100%;
  max-width: 360px;
  padding: var(--spacing-xl);
}

.login-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text-primary);
  text-align: center;
  margin-bottom: var(--spacing-xs);
}

.login-subtitle {
  font-size: 14px;
  color: var(--color-text-secondary);
  text-align: center;
  margin-bottom: var(--spacing-xl);
}

.invite-email {
  font-size: 13px;
  color: var(--color-text-secondary);
  text-align: center;
  margin-bottom: var(--spacing-lg);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.field-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.field-input {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  outline: none;
  transition: border-color var(--transition-fast);
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
}

.field-input:focus {
  border-color: var(--color-accent);
}

.field-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.password-strength {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
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

.error-msg {
  font-size: 13px;
  color: var(--color-danger);
  text-align: center;
}

.invalid-state {
  text-align: center;
}

.back-link {
  display: inline-block;
  margin-top: var(--spacing-md);
  font-size: 14px;
  color: var(--color-text-secondary);
  text-decoration: underline;
}

.back-link:hover {
  color: var(--color-text-primary);
}

.submit-btn {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-sm);
  background-color: var(--color-accent);
  color: var(--color-accent-inverse);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity var(--transition-fast);
  margin-top: var(--spacing-sm);
}

.submit-btn:hover:not(:disabled) {
  opacity: 0.85;
}

.submit-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
