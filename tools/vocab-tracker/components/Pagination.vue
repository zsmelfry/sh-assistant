<template>
  <div v-if="totalPages > 0" class="pagination">
    <span class="rangeText">
      第 {{ rangeStart }}-{{ rangeEnd }} 条，共 {{ store.totalWords }} 条
    </span>

    <div class="pageControls">
      <button
        class="pageBtn"
        :disabled="store.page === 1"
        @click="store.setPage(store.page - 1)"
      >
        &lt;
      </button>

      <template v-for="(p, idx) in visiblePages" :key="idx">
        <span v-if="p === 'ellipsis'" class="ellipsis">...</span>
        <button
          v-else
          class="pageBtn"
          :class="{ active: p === store.page }"
          @click="store.setPage(p)"
        >
          {{ p }}
        </button>
      </template>

      <button
        class="pageBtn"
        :disabled="store.page === totalPages"
        @click="store.setPage(store.page + 1)"
      >
        &gt;
      </button>

      <div class="jumpBox">
        <span class="jumpLabel">跳至</span>
        <input
          v-model="jumpTo"
          type="number"
          class="jumpInput"
          min="1"
          :max="totalPages"
          @keyup.enter="handleJump"
        />
        <button class="jumpBtn" @click="handleJump">Go</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const store = useVocabStore();

const totalPages = computed(() => store.totalPages);
const jumpTo = ref('');

const rangeStart = computed(() => (store.page - 1) * store.pageSize + 1);
const rangeEnd = computed(() => Math.min(store.page * store.pageSize, store.totalWords));

const visiblePages = computed(() => {
  const total = totalPages.value;
  const current = store.page;
  const pages: (number | 'ellipsis')[] = [];

  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i);
  } else {
    pages.push(1);
    if (current <= 3) {
      pages.push(2, 3, 4, 5, 'ellipsis', total);
    } else if (current >= total - 2) {
      pages.push('ellipsis', total - 4, total - 3, total - 2, total - 1, total);
    } else {
      pages.push('ellipsis', current - 1, current, current + 1, 'ellipsis', total);
    }
  }
  return pages;
});

function handleJump() {
  const p = parseInt(jumpTo.value, 10);
  if (!isNaN(p) && p >= 1 && p <= totalPages.value) {
    store.setPage(p);
    jumpTo.value = '';
  }
}
</script>

<style scoped>
.pagination {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
}

@media (min-width: 640px) {
  .pagination {
    flex-direction: row;
    justify-content: space-between;
  }
}

.rangeText {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.pageControls {
  display: flex;
  align-items: center;
  gap: 2px;
}

.pageBtn {
  min-width: 32px;
  height: 32px;
  padding: 0 var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  font-size: 13px;
  cursor: pointer;
  color: var(--color-text-primary);
  transition: all var(--transition-fast);
}

.pageBtn:hover:not(:disabled) {
  background-color: var(--color-bg-hover);
}

.pageBtn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.pageBtn.active {
  background-color: var(--color-accent);
  color: var(--color-accent-inverse);
  border-color: var(--color-accent);
}

.ellipsis {
  padding: 0 var(--spacing-xs);
  color: var(--color-text-secondary);
}

.jumpBox {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  margin-left: var(--spacing-sm);
  padding-left: var(--spacing-sm);
  border-left: 1px solid var(--color-border);
}

.jumpLabel {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.jumpInput {
  width: 52px;
  height: 28px;
  padding: 0 var(--spacing-xs);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  text-align: center;
  outline: none;
}

.jumpInput:focus {
  border-color: var(--color-accent);
}

.jumpBtn {
  padding: 0 var(--spacing-sm);
  height: 28px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  font-size: 12px;
  cursor: pointer;
  color: var(--color-text-secondary);
}

.jumpBtn:hover {
  background-color: var(--color-bg-hover);
}
</style>
