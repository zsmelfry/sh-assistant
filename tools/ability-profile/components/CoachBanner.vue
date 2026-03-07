<template>
  <div class="coach-banner" :class="`priority-${notification.priority || 'medium'}`">
    <div class="banner-body">
      <div class="banner-text">
        <span class="banner-title">{{ notification.title }}</span>
        <span class="banner-content">{{ notification.content }}</span>
      </div>
      <div class="banner-actions">
        <BaseButton size="sm" @click="$emit('action', notification)">
          {{ actionLabel }}
        </BaseButton>
        <button class="dismiss-btn" @click="$emit('dismiss', notification.id)" title="dismiss">&times;</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  notification: {
    id: number;
    type: string;
    title: string;
    content: string;
    priority?: string;
    actionType?: string;
    skillId?: number;
  };
}>();

defineEmits<{
  action: [notification: typeof props.notification];
  dismiss: [id: number];
}>();

const actionLabel = computed(() => {
  switch (props.notification.actionType) {
    case 'chat': return '开始对话';
    case 'view_skill': return '查看技能';
    case 'confirm_state': return '去确认';
    default: return '查看';
  }
});
</script>

<style scoped>
.coach-banner {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-md);
  background-color: var(--color-bg-hover);
  border-left: 3px solid var(--color-border);
}

.coach-banner.priority-high {
  border-left-color: var(--color-accent);
}

.coach-banner.priority-medium {
  border-left-color: var(--color-text-secondary);
}

.coach-banner.priority-low {
  border-left-color: var(--color-border);
}

.banner-body {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-md);
}

.banner-text {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  flex: 1;
  min-width: 0;
}

.banner-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.banner-content {
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.banner-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-shrink: 0;
}

.dismiss-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 18px;
  color: var(--color-text-secondary);
  padding: var(--spacing-xs);
  line-height: 1;
  border-radius: var(--radius-sm);
}

.dismiss-btn:hover {
  color: var(--color-text-primary);
  background-color: var(--color-bg-hover);
}

@media (max-width: 768px) {
  .banner-body {
    flex-direction: column;
  }

  .banner-actions {
    align-self: flex-end;
  }
}
</style>
