<template>
  <div class="filterBar">
    <div class="searchBox">
      <input
        v-model="localSearch"
        type="text"
        class="searchInput"
        placeholder="搜索词汇..."
        @input="handleSearchInput"
      />
      <button
        v-if="localSearch"
        class="clearBtn"
        @click="clearSearch"
      >
        &times;
      </button>
    </div>

    <div class="filters">
      <button
        v-for="f in filters"
        :key="f.value"
        class="filterBtn"
        :class="{ active: currentFilter === f.value }"
        @click="handleFilterChange(f.value)"
      >
        {{ f.label }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FilterType } from '../types';
import { FILTER_LABELS } from '../types';

const store = useVocabStore();

const filters = Object.entries(FILTER_LABELS).map(([value, label]) => ({
  value: value as FilterType,
  label,
}));

const currentFilter = computed(() => store.filter);
const localSearch = ref(store.searchQuery);

let searchTimeout: ReturnType<typeof setTimeout> | null = null;

function handleFilterChange(f: FilterType) {
  store.setFilter(f);
}

function handleSearchInput() {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    store.setSearch(localSearch.value);
  }, 300);
}

function clearSearch() {
  localSearch.value = '';
  store.setSearch('');
}

watch(() => store.searchQuery, (val) => {
  localSearch.value = val;
});

onUnmounted(() => {
  if (searchTimeout) clearTimeout(searchTimeout);
});
</script>

<style scoped>
.filterBar {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

@media (min-width: 640px) {
  .filterBar {
    flex-direction: row;
    align-items: center;
  }
}

.searchBox {
  position: relative;
  flex-shrink: 0;
  width: 100%;
  max-width: 250px;
}

.searchInput {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  padding-right: 32px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 13px;
  outline: none;
  transition: border-color var(--transition-fast);
}

.searchInput:focus {
  border-color: var(--color-accent);
}

.clearBtn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

.filterBtn {
  padding: var(--spacing-xs) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-primary);
  font-size: 13px;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
}

.filterBtn:hover {
  background-color: var(--color-bg-hover);
}

.filterBtn.active {
  background-color: var(--color-accent);
  color: var(--color-accent-inverse);
  border-color: var(--color-accent);
}
</style>
