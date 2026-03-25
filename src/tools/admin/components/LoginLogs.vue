<template>
  <div class="login-logs">
    <div class="logs-label">登录记录</div>

    <div v-if="loading" class="logs-loading">加载中...</div>

    <div v-else-if="logs.length === 0" class="logs-empty">暂无登录记录</div>

    <table v-else class="logs-table">
      <thead>
        <tr>
          <th>时间</th>
          <th>方式</th>
          <th>IP</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="log in logs" :key="log.id">
          <td class="mono">{{ formatTime(log.createdAt) }}</td>
          <td>{{ log.method === 'password' ? '密码' : 'Token' }}</td>
          <td class="mono">{{ log.ip || '--' }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  userId: number;
}>();

interface LoginLogEntry {
  id: number;
  userId: number;
  username: string;
  method: string;
  ip: string | null;
  createdAt: number;
}

const logs = ref<LoginLogEntry[]>([]);
const loading = ref(true);

async function fetchLogs() {
  loading.value = true;
  try {
    logs.value = await $fetch<LoginLogEntry[]>(`/api/admin/login-logs`, {
      params: { userId: props.userId, limit: 20 },
    });
  } catch {
    logs.value = [];
  } finally {
    loading.value = false;
  }
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

watch(() => props.userId, () => fetchLogs(), { immediate: true });
</script>

<style scoped>
.login-logs {
  margin-top: var(--spacing-md);
}

.logs-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--color-text-tertiary);
  font-weight: 600;
  margin-bottom: var(--spacing-sm);
}

.logs-loading,
.logs-empty {
  font-size: 12px;
  color: var(--color-text-tertiary);
  padding: var(--spacing-sm) 0;
}

.logs-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.logs-table th {
  text-align: left;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--color-text-tertiary);
  font-weight: 500;
  padding: var(--spacing-xs) var(--spacing-sm);
  border-bottom: 1px solid var(--color-border);
}

.logs-table td {
  padding: var(--spacing-xs) var(--spacing-sm);
  color: var(--color-text-primary);
  border-bottom: 1px solid var(--color-border);
}

.logs-table tr:last-child td {
  border-bottom: none;
}

.mono {
  font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
  letter-spacing: -0.2px;
}
</style>
