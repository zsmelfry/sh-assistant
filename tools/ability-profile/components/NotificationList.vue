<template>
  <div v-if="notifications.length > 0" class="notification-list">
    <h3 class="section-title">通知</h3>
    <div class="notification-items">
      <div
        v-for="n in notifications"
        :key="n.id"
        class="notification-item"
      >
        <div class="notification-text">
          <span class="notification-title">{{ n.title }}</span>
          <span class="notification-content">{{ n.content }}</span>
        </div>
        <div class="notification-actions">
          <BaseButton size="sm" variant="ghost" @click="$emit('action', n)">
            {{ getActionLabel(n) }}
          </BaseButton>
          <button class="dismiss-btn" @click="$emit('dismiss', n.id)" title="dismiss">&times;</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  notifications: any[];
}>();

defineEmits<{
  action: [notification: any];
  dismiss: [id: number];
}>();

function getActionLabel(n: any) {
  if (n.type === 'weekly_review' || n.type === 'monthly_report') return '查看详情';
  switch (n.actionType) {
    case 'chat': return '对话';
    case 'view_skill': return '查看';
    case 'confirm_state': return '确认';
    default: return '查看';
  }
}
</script>

<style scoped>
.notification-list {
  margin-top: var(--spacing-md);
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-sm);
}

.notification-items {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.notification-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background-color: var(--color-bg-primary);
}

.notification-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.notification-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.notification-content {
  font-size: 12px;
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.notification-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  flex-shrink: 0;
}

.dismiss-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  color: var(--color-text-secondary);
  padding: var(--spacing-xs);
  line-height: 1;
  border-radius: var(--radius-sm);
}

.dismiss-btn:hover {
  color: var(--color-text-primary);
  background-color: var(--color-bg-hover);
}
</style>
