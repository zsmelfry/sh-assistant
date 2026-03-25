<template>
  <div class="login-card">
    <h1 class="login-title">个人助手</h1>
    <p class="login-subtitle">请登录以继续</p>

    <form class="login-form" @submit.prevent="handleSubmit">
      <div class="field">
        <label class="field-label" for="identifier">用户名或邮箱</label>
        <input
          id="identifier"
          v-model="identifier"
          type="text"
          class="field-input"
          autocomplete="username"
          :disabled="loading"
          @input="error = ''"
        />
      </div>

      <div class="field">
        <label class="field-label" for="password">密码</label>
        <input
          id="password"
          v-model="password"
          type="password"
          class="field-input"
          autocomplete="current-password"
          :disabled="loading"
          @input="error = ''"
        />
      </div>

      <p v-if="error" class="error-msg">{{ error }}</p>

      <button
        type="submit"
        class="submit-btn"
        :disabled="loading || !identifier || !password"
      >
        {{ loading ? '登录中...' : '登录' }}
      </button>

      <div class="form-footer">
        <NuxtLink to="/forgot-password" class="forgot-link">忘记密码？</NuxtLink>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { registerSkillTools } from '~/plugins/tools.client';

definePageMeta({
  layout: 'auth',
});

const { login } = useAuth();

const identifier = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

async function handleSubmit() {
  if (!identifier.value || !password.value) return;

  loading.value = true;
  error.value = '';

  try {
    await login(identifier.value, password.value);
    await registerSkillTools();
    await navigateTo('/');
  } catch (e: unknown) {
    error.value = extractErrorMessage(e, '登录失败，请重试');
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

.forgot-link {
  font-size: 13px;
  color: var(--color-text-secondary);
  text-decoration: underline;
}

.forgot-link:hover {
  color: var(--color-text-primary);
}
</style>
