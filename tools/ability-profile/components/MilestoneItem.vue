<template>
  <div class="milestone" :class="{ 'milestone--completed': !!milestone.completion, 'milestone--locked': locked }">
    <div class="milestone-left">
      <span class="milestone-icon" :title="VERIFY_METHOD_LABELS[milestone.verifyMethod]">
        {{ verifyIcon }}
      </span>
      <div class="milestone-content">
        <span class="milestone-title" :class="{ 'milestone-title--completed': !!milestone.completion }">
          {{ milestone.title }}
        </span>
        <span v-if="milestone.description" class="milestone-desc">{{ milestone.description }}</span>
      </div>
    </div>

    <div class="milestone-right">
      <span class="milestone-type-badge">{{ MILESTONE_TYPE_LABELS[milestone.milestoneType] }}</span>
      <span v-if="locked" class="milestone-locked-hint">需先完成上一段位</span>
      <BaseButton
        v-else-if="!milestone.completion"
        variant="ghost"
        @click.stop="$emit('complete', milestone.id)"
      >
        完成
      </BaseButton>
      <span v-else class="milestone-done">
        ✓ {{ formatDate(milestone.completion.verifiedAt) }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Milestone } from '../types';
import { VERIFY_METHOD_LABELS, MILESTONE_TYPE_LABELS } from '../types';

const props = defineProps<{
  milestone: Milestone;
  locked?: boolean;
}>();

defineEmits<{
  complete: [milestoneId: number];
}>();

const verifyIcon = computed(() => {
  switch (props.milestone.verifyMethod) {
    case 'platform_auto': return '●';
    case 'platform_test': return '●';
    case 'evidence': return '◐';
    case 'self_declare': return '○';
    default: return '○';
  }
});

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}
</script>

<style scoped>
.milestone {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-sm) var(--spacing-md);
  border-bottom: 1px solid var(--color-border);
  gap: var(--spacing-sm);
}

.milestone:last-child {
  border-bottom: none;
}

.milestone--completed {
  opacity: 0.7;
}

.milestone-left {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex: 1;
  min-width: 0;
}

.milestone-icon {
  font-size: 12px;
  flex-shrink: 0;
  width: 16px;
  text-align: center;
}

.milestone-content {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.milestone-title {
  font-size: 14px;
  color: var(--color-text-primary);
}

.milestone-title--completed {
  text-decoration: line-through;
  color: var(--color-text-secondary);
}

.milestone-desc {
  font-size: 12px;
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.milestone-right {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-shrink: 0;
}

.milestone-type-badge {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  background-color: var(--color-bg-hover);
  color: var(--color-text-secondary);
}

.milestone-done {
  font-size: 12px;
  color: var(--color-success);
}

.milestone--locked {
  opacity: 0.5;
}

.milestone-locked-hint {
  font-size: 11px;
  color: var(--color-text-secondary);
  font-style: italic;
}
</style>
