<template>
  <div class="login-card">
    <h1 class="login-title">个人助手</h1>
    <p class="login-subtitle">重置密码</p>

    <!-- Success state -->
    <div v-if="submitted" class="success-state">
      <p class="success-msg">如果该邮箱已注册，我们已发送重置链接到您的邮箱。</p>
      <p class="success-hint">请检查您的收件箱（包括垃圾邮件文件夹）。</p>
      <NuxtLink to="/login" class="back-link">返回登录</NuxtLink>
    </div>

    <!-- Form state -->
    <template v-else>
      <form class="login-form" @submit.prevent="handleSubmit">
        <div class="field">
          <label class="field-label" for="email">邮箱</label>
          <input
            id="email"
            v-model="email"
            type="email"
            class="field-input"
            autocomplete="email"
            placeholder="请输入注册邮箱"
            :disabled="loading"
            @input="error = ''"
          />
        </div>

        <p v-if="error" class="error-msg">{{ error }}</p>

        <button
          type="submit"
          class="submit-btn"
          :disabled="loading || !email"
        >
          {{ loading ? '发送中...' : '发送重置链接' }}
        </button>

        <div class="form-footer">
          <NuxtLink to="/login" class="back-link">返回登录</NuxtLink>
        </div>
      </form>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'auth',
});

const { forgotPassword } = useAuth();

const email = ref('');
const error = ref('');
const loading = ref(false);
const submitted = ref(false);

async function handleSubmit() {
  if (!email.value) return;

  loading.value = true;
  error.value = '';

  try {
    await forgotPassword(email.value);
    submitted.value = true;
  } catch (e: unknown) {
    error.value = extractErrorMessage(e, '发送失败，请重试');
  } finally {
    loading.value = false;
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

.error-msg {
  font-size: 13px;
  color: var(--color-danger);
}

.success-state {
  text-align: center;
}

.success-msg {
  font-size: 14px;
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-sm);
}

.success-hint {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-lg);
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

.form-footer {
  text-align: center;
}

.back-link {
  display: inline-block;
  margin-top: var(--spacing-md);
  font-size: 13px;
  color: var(--color-text-secondary);
  text-decoration: underline;
}

.back-link:hover {
  color: var(--color-text-primary);
}
</style>
