<template>
  <nav class="viewNav">
    <div class="yearSelector">
      <div class="yearPills">
        <button
          v-for="y in years"
          :key="y"
          class="yearPill"
          :class="{ active: y === selectedYear }"
          @click="$emit('changeYear', y)"
        >
          {{ y }}
        </button>
        <button
          v-if="!showYearInput"
          class="yearPill addBtn"
          @click="openYearInput"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
        <div v-else class="yearInputWrap">
          <input
            ref="yearInputRef"
            v-model="yearInputValue"
            class="yearInput"
            type="number"
            :min="2020"
            :max="2099"
            placeholder="年份"
            @keydown.enter="confirmAddYear"
            @keydown.escape="showYearInput = false"
            @blur="confirmAddYear"
          />
        </div>
      </div>
    </div>
    <div class="tabs">
      <button
        class="navTab"
        :class="{ active: currentType === 'overview' }"
        @click="$emit('navigate', { type: 'overview' })"
      >
        总览
      </button>
      <button
        class="navTab"
        :class="{ active: currentType === 'tags' }"
        @click="$emit('navigate', { type: 'tags' })"
      >
        标签
      </button>
    </div>
  </nav>
</template>

<script setup lang="ts">
import type { PlannerView } from '../types';

const props = defineProps<{
  currentType: PlannerView['type'];
  selectedYear: number;
  years: number[];
}>();

const emit = defineEmits<{
  navigate: [view: PlannerView];
  changeYear: [year: number];
  addYear: [year: number];
}>();

const showYearInput = ref(false);
const yearInputValue = ref('');
const yearInputRef = ref<HTMLInputElement | null>(null);

function openYearInput() {
  yearInputValue.value = String(Math.max(...props.years) + 1);
  showYearInput.value = true;
  nextTick(() => yearInputRef.value?.select());
}

function confirmAddYear() {
  const year = parseInt(yearInputValue.value);
  if (year >= 2020 && year <= 2099 && !props.years.includes(year)) {
    emit('addYear', year);
  }
  showYearInput.value = false;
}
</script>

<style scoped>
.viewNav {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
  border-bottom: 1px solid var(--color-border);
  margin-bottom: var(--spacing-lg);
  padding-bottom: 0;
}

.yearSelector {
  display: flex;
  align-items: center;
}

.yearPills {
  display: flex;
  align-items: center;
  gap: 2px;
  background: var(--color-bg-hover);
  border-radius: 6px;
  padding: 2px;
}

.yearPill {
  position: relative;
  padding: 6px 14px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 13px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
  letter-spacing: 0.02em;
}

.yearPill:hover:not(.active) {
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
}

.yearPill.active {
  background: var(--color-accent);
  color: var(--color-accent-inverse);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}

.yearPill.addBtn {
  padding: 6px 8px;
  color: var(--color-text-disabled);
}

.yearPill.addBtn:hover {
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
}

.yearInputWrap {
  display: flex;
  align-items: center;
}

.yearInput {
  width: 64px;
  padding: 4px 8px;
  border: 1px solid var(--color-accent);
  border-radius: 4px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: 13px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  text-align: center;
  outline: none;
  -moz-appearance: textfield;
}

.yearInput::-webkit-inner-spin-button,
.yearInput::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.tabs {
  display: flex;
  gap: var(--spacing-xs);
}

.navTab {
  padding: var(--spacing-sm) var(--spacing-md);
  border: none;
  background: none;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-secondary);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all var(--transition-fast);
}

.navTab:hover {
  color: var(--color-text-primary);
}

.navTab.active {
  color: var(--color-text-primary);
  border-bottom-color: var(--color-accent);
}

@media (max-width: 768px) {
  .viewNav {
    gap: var(--spacing-sm);
  }
  .yearPill {
    padding: 6px 10px;
    font-size: 12px;
  }
  .tabs {
    flex: 1;
  }
  .navTab {
    min-height: var(--touch-target-min);
    flex: 1;
    text-align: center;
  }
  .navTab:active {
    color: var(--color-text-primary);
  }
}
</style>
