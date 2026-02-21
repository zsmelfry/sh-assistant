<template>
  <div class="domainCard" @click="$emit('click')">
    <h3 class="cardTitle">{{ domain.name }}</h3>
    <p v-if="domain.description" class="cardDesc">{{ domain.description }}</p>
    <div class="cardStats">
      <span class="statItem">{{ domain.topicCount }} 个主题</span>
      <span class="statDot" />
      <span class="statItem">{{ domain.completedCount }}/{{ domain.pointCount }} 知识点</span>
    </div>
    <div class="progressBar">
      <div
        class="progressFill"
        :style="{ width: progressPercent + '%' }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DomainWithStats } from '~/composables/skill-learning/types';

const props = defineProps<{
  domain: DomainWithStats;
}>();

defineEmits<{
  click: [];
}>();

const progressPercent = computed(() => props.domain.completionRate ?? 0);
</script>

<style scoped>
.domainCard {
  padding: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.domainCard:hover {
  border-color: var(--color-accent);
}

.cardTitle {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-xs);
}

.cardDesc {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-sm);
  line-height: 1.4;
}

.cardStats {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
}

.statItem {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.statDot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--color-text-disabled);
}

.progressBar {
  height: 4px;
  background: var(--color-chart-empty);
  border-radius: 2px;
  overflow: hidden;
}

.progressFill {
  height: 100%;
  background: var(--color-accent);
  border-radius: 2px;
  transition: width 300ms ease;
}
</style>
