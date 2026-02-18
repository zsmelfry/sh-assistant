<template>
  <div class="calendarNav">
    <button class="navBtn" aria-label="上个月" @click="$emit('prev')">
      &lt;
    </button>
    <span class="monthTitle">{{ displayTitle }}</span>
    <button class="navBtn" aria-label="下个月" @click="$emit('next')">
      &gt;
    </button>
  </div>
</template>

<script setup lang="ts">
import type { YearMonth } from '../types';

const props = defineProps<{
  month: YearMonth;
}>();

defineEmits<{
  prev: [];
  next: [];
}>();

const displayTitle = computed(() => {
  const [year, month] = props.month.split('-');
  return `${year}年${parseInt(month)}月`;
});
</script>

<style scoped>
.calendarNav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-md);
}

.navBtn {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 14px;
  color: var(--color-text-primary);
}

.navBtn:hover {
  background-color: var(--color-bg-hover);
}

.monthTitle {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  min-width: 120px;
  text-align: center;
}
</style>
