<template>
  <div
    role="button"
    class="day"
    :class="{
      checkedIn: day.isCheckedIn,
      Today: day.isToday,
      Future: day.isFuture,
      PeriodCompleted: day.isPeriodCompleted && !day.isCheckedIn,
      outside: !day.isCurrentMonth,
    }"
    :tabindex="day.isFuture || !day.isCurrentMonth ? -1 : 0"
    @click="handleClick"
    @keydown.enter="handleClick"
  >
    {{ day.dayOfMonth }}
  </div>
</template>

<script setup lang="ts">
import type { CalendarDayData } from '../types';

const props = defineProps<{
  day: CalendarDayData;
}>();

const emit = defineEmits<{
  toggle: [date: string];
}>();

function handleClick() {
  if (props.day.isFuture || !props.day.isCurrentMonth) return;
  emit('toggle', props.day.date);
}
</script>

<style scoped>
.day {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  border-radius: var(--radius-sm);
  font-size: 13px;
  cursor: pointer;
  transition: all var(--transition-fast);
  border: 2px solid transparent;
  color: var(--color-text-primary);
  user-select: none;
}

.day:hover:not(.Future):not(.outside) {
  background-color: var(--color-bg-hover);
}

.day.checkedIn {
  background-color: var(--color-accent);
  color: var(--color-accent-inverse);
}

.day.Today {
  border-color: var(--color-accent);
  font-weight: 700;
}

.day.Today.checkedIn {
  border-color: var(--color-accent);
}

.day.Future {
  color: var(--color-text-disabled);
  cursor: default;
}

.day.PeriodCompleted {
  background-color: var(--color-bg-hover);
}

.day.outside {
  visibility: hidden;
}

@media (max-width: 768px) {
  .day {
    min-height: var(--touch-target-min);
    font-size: 14px;
  }
  .day:active:not(.Future):not(.outside) {
    background-color: var(--color-bg-hover);
  }
}
</style>
