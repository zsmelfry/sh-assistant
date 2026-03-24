<template>
  <div class="skill-card" @click="$emit('select', skill.id)">
    <div class="skill-header">
      <span class="skill-name">{{ skill.name }}</span>
      <span class="skill-category">{{ skill.categoryName }}</span>
    </div>

    <div class="skill-tier">
      <span
        v-for="star in 5"
        :key="star"
        class="star"
        :class="{ 'star--filled': star <= skill.currentTier }"
      >★</span>
      <span class="tier-label">{{ TIER_NAMES[skill.currentTier] }}</span>
    </div>

    <div class="skill-progress">
      <div class="progress-bar">
        <div
          class="progress-fill"
          :style="{ width: progressPercent + '%' }"
        />
      </div>
      <span class="progress-text">
        {{ skill.completedMilestones }}/{{ skill.totalMilestones }} 里程碑
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Skill } from '../types';
import { TIER_NAMES } from '../types';

const props = defineProps<{
  skill: Skill;
}>();

defineEmits<{
  select: [id: number];
}>();

const progressPercent = computed(() => {
  if (props.skill.totalMilestones === 0) return 0;
  return Math.round((props.skill.completedMilestones / props.skill.totalMilestones) * 100);
});
</script>

<style scoped>
.skill-card {
  padding: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.skill-card:hover {
  background-color: var(--color-bg-hover);
}

.skill-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-sm);
}

.skill-name {
  font-weight: 600;
  font-size: 15px;
  color: var(--color-text-primary);
}

.skill-category {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.skill-tier {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-bottom: var(--spacing-sm);
}

.star {
  font-size: 14px;
  color: var(--color-text-disabled);
}

.star--filled {
  color: var(--color-accent);
}

.tier-label {
  margin-left: var(--spacing-sm);
  font-size: 12px;
  color: var(--color-text-secondary);
}

.skill-progress {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.progress-bar {
  flex: 1;
  height: 4px;
  background-color: var(--color-chart-empty);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background-color: var(--color-accent);
  border-radius: 2px;
  transition: width var(--transition-fast);
}

.progress-text {
  font-size: 12px;
  color: var(--color-text-secondary);
  white-space: nowrap;
}
</style>
