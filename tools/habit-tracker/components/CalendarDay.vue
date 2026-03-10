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
      hasNote: !!day.note,
    }"
    :tabindex="day.isFuture || !day.isCurrentMonth ? -1 : 0"
    @click="handleClick"
    @keydown.enter="handleClick"
    @dblclick.prevent="handleDoubleClick"
    @touchstart.passive="handleTouchStart"
    @touchend.passive="handleTouchEnd"
    @touchcancel.passive="handleTouchEnd"
  >
    {{ day.dayOfMonth }}
    <span v-if="day.note" class="noteDot" />
  </div>
</template>

<script setup lang="ts">
import type { CalendarDayData } from '../types';

const props = defineProps<{
  day: CalendarDayData;
}>();

const emit = defineEmits<{
  toggle: [date: string];
  'open-note': [date: string];
}>();

let longPressTimer: ReturnType<typeof setTimeout> | null = null;
let isLongPress = false;
let clickTimer: ReturnType<typeof setTimeout> | null = null;

function handleClick() {
  if (props.day.isFuture || !props.day.isCurrentMonth) return;
  if (isLongPress) {
    isLongPress = false;
    return;
  }

  // 已打卡时延迟单击，等双击判定
  if (props.day.isCheckedIn) {
    if (clickTimer) {
      // 第二次点击 → 双击 → 打开备注
      clearTimeout(clickTimer);
      clickTimer = null;
      emit('open-note', props.day.date);
    } else {
      clickTimer = setTimeout(() => {
        clickTimer = null;
        emit('toggle', props.day.date);
      }, 250);
    }
  } else {
    emit('toggle', props.day.date);
  }
}

function handleDoubleClick() {
  // 已在 handleClick 中处理，阻止默认行为即可
}

function handleTouchStart() {
  isLongPress = false;
  longPressTimer = setTimeout(() => {
    isLongPress = true;
    if (props.day.isCheckedIn && !props.day.isFuture && props.day.isCurrentMonth) {
      emit('open-note', props.day.date);
    }
  }, 500);
}

function handleTouchEnd() {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
}
</script>

<style scoped>
.day {
  position: relative;
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

/* Note dot indicator */
.noteDot {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background-color: var(--color-accent-inverse);
  opacity: 0.8;
}

.day:not(.checkedIn) .noteDot {
  background-color: var(--color-accent);
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
