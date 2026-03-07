<template>
  <div class="focus-card">
    <div class="focus-header">
      <span class="focus-skill" @click="$emit('view-skill', plan.skillId)">
        {{ plan.skillName }}
      </span>
      <span class="focus-status" :class="`status-${plan.status}`">
        {{ statusLabel }}
      </span>
    </div>

    <div class="focus-tiers">
      <span class="tier-from">{{ TIER_NAMES[plan.skillCurrentTier] }}</span>
      <span class="tier-arrow">→</span>
      <span class="tier-to">{{ TIER_NAMES[plan.targetTier] }}</span>
    </div>

    <div class="focus-meta">
      <span class="focus-date">截止 {{ plan.targetDate }}</span>
      <span v-if="daysLeft >= 0" class="focus-days" :class="{ 'days-urgent': daysLeft <= 7 }">
        {{ daysLeft === 0 ? '今天截止' : `剩余 ${daysLeft} 天` }}
      </span>
      <span v-else class="focus-days days-overdue">已逾期 {{ -daysLeft }} 天</span>
    </div>

    <div v-if="plan.strategy" class="focus-strategy">
      <details>
        <summary>提升策略</summary>
        <div class="strategy-content" v-html="renderMarkdown(plan.strategy)" />
      </details>
    </div>

    <div v-if="plan.status === 'active'" class="focus-actions">
      <BaseButton v-if="!plan.strategy" variant="ghost" @click="$emit('generate-strategy', plan.id)">
        生成策略
      </BaseButton>
      <BaseButton variant="ghost" @click="$emit('abandon', plan.id)">放弃</BaseButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FocusPlan } from '../types';
import { TIER_NAMES } from '../types';

const props = defineProps<{
  plan: FocusPlan;
}>();

defineEmits<{
  'view-skill': [skillId: number];
  'generate-strategy': [planId: number];
  abandon: [planId: number];
}>();

const statusLabel = computed(() => {
  switch (props.plan.status) {
    case 'active': return '进行中';
    case 'achieved': return '已达成';
    case 'abandoned': return '已放弃';
    default: return '';
  }
});

const daysLeft = computed(() => {
  const target = new Date(props.plan.targetDate).getTime();
  const now = Date.now();
  return Math.ceil((target - now) / (24 * 60 * 60 * 1000));
});

function renderMarkdown(text: string) {
  // Simple markdown: bold, lists, headers
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^### (.*$)/gm, '<h4>$1</h4>')
    .replace(/^## (.*$)/gm, '<h3>$1</h3>')
    .replace(/^- (.*$)/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\n/g, '<br/>');
}
</script>

<style scoped>
.focus-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.focus-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.focus-skill {
  font-weight: 600;
  font-size: 15px;
  color: var(--color-text-primary);
  cursor: pointer;
}

.focus-skill:hover {
  text-decoration: underline;
}

.focus-status {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
}

.status-active {
  background-color: var(--color-success-bg);
  color: var(--color-success);
}

.status-achieved {
  background-color: var(--color-bg-hover);
  color: var(--color-text-secondary);
}

.status-abandoned {
  background-color: var(--color-danger-bg);
  color: var(--color-danger);
}

.focus-tiers {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: 14px;
}

.tier-from {
  color: var(--color-text-secondary);
}

.tier-arrow {
  color: var(--color-text-disabled);
}

.tier-to {
  font-weight: 600;
  color: var(--color-text-primary);
}

.focus-meta {
  display: flex;
  gap: var(--spacing-sm);
  font-size: 12px;
  color: var(--color-text-secondary);
}

.days-urgent {
  color: var(--color-warning);
}

.days-overdue {
  color: var(--color-danger);
}

.focus-strategy details {
  font-size: 13px;
}

.focus-strategy summary {
  cursor: pointer;
  color: var(--color-text-secondary);
  font-size: 12px;
}

.strategy-content {
  margin-top: var(--spacing-sm);
  padding: var(--spacing-sm);
  background-color: var(--color-bg-hover);
  border-radius: var(--radius-sm);
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-text-primary);
}

.strategy-content :deep(ul) {
  padding-left: var(--spacing-lg);
}

.focus-actions {
  display: flex;
  gap: var(--spacing-xs);
  padding-top: var(--spacing-xs);
}
</style>
