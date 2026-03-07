<template>
  <div class="tier-progress">
    <div class="tier-stars">
      <span
        v-for="star in 5"
        :key="star"
        class="star"
        :class="{
          'star--filled': star <= currentTier,
          'star--next': star === currentTier + 1,
        }"
      >★</span>
    </div>
    <div class="tier-info">
      <span class="tier-current">{{ TIER_NAMES[currentTier] }}</span>
      <span v-if="currentTier < 5" class="tier-next">
        → {{ TIER_NAMES[currentTier + 1] }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { TIER_NAMES } from '../types';

defineProps<{
  currentTier: number;
}>();
</script>

<style scoped>
.tier-progress {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.tier-stars {
  display: flex;
  gap: 2px;
}

.star {
  font-size: 20px;
  color: var(--color-text-disabled);
  transition: color var(--transition-fast);
}

.star--filled {
  color: var(--color-accent);
}

.star--next {
  color: var(--color-border);
}

.tier-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.tier-current {
  font-weight: 600;
  font-size: 15px;
  color: var(--color-text-primary);
}

.tier-next {
  font-size: 13px;
  color: var(--color-text-secondary);
}
</style>
