<template>
  <div class="categorizeView">
    <div class="catHeader">
      <span class="catCount">{{ unreadTotal }} 个未读单词</span>
      <span v-if="categorizedCount > 0" class="catProgress">
        本次已分类 {{ categorizedCount }} 个
      </span>
    </div>

    <div v-if="loading && localWords.length === 0" class="catEmpty">
      加载中...
    </div>

    <div v-else-if="localWords.length === 0" class="catEmpty">
      <template v-if="unreadTotal > 0">
        当前页已分类完成
        <button class="refreshBtn" @click="reload">加载下一批</button>
      </template>
      <template v-else>
        {{ categorizedCount > 0 ? '所有未读单词已分类完成' : '没有未读单词' }}
      </template>
    </div>

    <template v-else>
      <div class="catToolbar">
        <label class="selectAllLabel">
          <input
            type="checkbox"
            class="checkbox"
            :checked="allSelected"
            @change="toggleSelectAll"
          />
          <span>全选</span>
        </label>
        <span v-if="selectedIds.size > 0" class="selectedInfo">
          已选 {{ selectedIds.size }} 个
        </span>
      </div>

      <div class="catList">
        <div
          v-for="w in localWords"
          :key="w.id"
          class="catItem"
          :class="{ selected: selectedIds.has(w.id) }"
        >
          <input
            type="checkbox"
            class="checkbox"
            :checked="selectedIds.has(w.id)"
            @change="toggleSelect(w.id)"
          />
          <span class="rank">#{{ w.rank }}</span>
          <span class="word">{{ w.word }}</span>
          <div class="itemActions">
            <button class="catBtn" @click="categorizeOne(w.id, 'SET_TO_LEARN')">待学习</button>
            <button class="catBtn" @click="categorizeOne(w.id, 'SET_LEARNING')">开始学习</button>
            <button class="catBtn catBtnPrimary" @click="categorizeOne(w.id, 'SET_MASTERED')">已掌握</button>
          </div>
        </div>
      </div>

      <div class="catPagination">
        <button class="pageBtn" :disabled="currentPage <= 1" @click="goPage(currentPage - 1)">
          上一页
        </button>
        <span class="pageInfo">{{ currentPage }} / {{ totalPages }}</span>
        <button class="pageBtn" :disabled="currentPage >= totalPages" @click="goPage(currentPage + 1)">
          下一页
        </button>
      </div>
    </template>

    <!-- Batch action bar (fixed bottom) -->
    <div v-if="selectedIds.size > 0" class="batchBar">
      <span class="batchInfo">已选 {{ selectedIds.size }} 个</span>
      <div class="batchActions">
        <button class="batchBtn" @click="batchAction('SET_TO_LEARN')">待学习</button>
        <button class="batchBtn" @click="batchAction('SET_LEARNING')">开始学习</button>
        <button class="batchBtn batchBtnPrimary" @click="batchAction('SET_MASTERED')">已掌握</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { WordWithProgress, StatusAction, WordListResponse } from '../types';

const store = useVocabStore();

const localWords = ref<WordWithProgress[]>([]);
const unreadTotal = ref(0);
const loading = ref(false);
const currentPage = ref(1);
const pageSize = 50;
const categorizedCount = ref(0);
const selectedIds = ref<Set<number>>(new Set());

const totalPages = computed(() => Math.max(1, Math.ceil(unreadTotal.value / pageSize)));

const allSelected = computed(() =>
  localWords.value.length > 0 && localWords.value.every(w => selectedIds.value.has(w.id)),
);

async function loadWords() {
  if (!store.currentUserId) return;
  loading.value = true;
  try {
    const result = await $fetch<WordListResponse>('/api/vocab/words', {
      params: {
        userId: store.currentUserId,
        filter: 'unread',
        page: currentPage.value,
        pageSize,
      },
    });
    localWords.value = result.words;
    unreadTotal.value = result.total;
    selectedIds.value = new Set();
  } finally {
    loading.value = false;
  }
}

async function goPage(p: number) {
  currentPage.value = p;
  await loadWords();
}

async function reload() {
  currentPage.value = 1;
  await loadWords();
}

function toggleSelect(wordId: number) {
  const newSet = new Set(selectedIds.value);
  if (newSet.has(wordId)) {
    newSet.delete(wordId);
  } else {
    newSet.add(wordId);
  }
  selectedIds.value = newSet;
}

function toggleSelectAll() {
  if (allSelected.value) {
    selectedIds.value = new Set();
  } else {
    selectedIds.value = new Set(localWords.value.map(w => w.id));
  }
}

async function categorizeOne(wordId: number, action: StatusAction) {
  if (!store.currentUserId) return;

  // Save state for rollback
  const prevWords = localWords.value;
  const prevSelected = selectedIds.value;
  const prevCount = categorizedCount.value;
  const prevTotal = unreadTotal.value;

  // Optimistic removal
  const newSelected = new Set(selectedIds.value);
  newSelected.delete(wordId);
  localWords.value = localWords.value.filter(w => w.id !== wordId);
  selectedIds.value = newSelected;
  categorizedCount.value++;
  unreadTotal.value--;

  try {
    await $fetch('/api/vocab/progress/status', {
      method: 'POST',
      body: { userId: store.currentUserId, wordId, action },
    });

    // Auto-reload when list is empty and there are more words
    if (localWords.value.length === 0 && unreadTotal.value > 0) {
      currentPage.value = 1;
      await loadWords();
    }
  } catch {
    // Rollback on failure
    localWords.value = prevWords;
    selectedIds.value = prevSelected;
    categorizedCount.value = prevCount;
    unreadTotal.value = prevTotal;
  }
}

async function batchAction(action: StatusAction) {
  if (!store.currentUserId || selectedIds.value.size === 0) return;

  const ids = Array.from(selectedIds.value);

  // Save state for rollback
  const prevWords = localWords.value;
  const prevSelected = selectedIds.value;
  const prevCount = categorizedCount.value;
  const prevTotal = unreadTotal.value;

  // Optimistic removal
  localWords.value = localWords.value.filter(w => !selectedIds.value.has(w.id));
  categorizedCount.value += ids.length;
  unreadTotal.value -= ids.length;
  selectedIds.value = new Set();

  try {
    await $fetch('/api/vocab/progress/batch', {
      method: 'POST',
      body: { userId: store.currentUserId, wordIds: ids, action },
    });

    // Auto-reload when list is empty and there are more words
    if (localWords.value.length === 0 && unreadTotal.value > 0) {
      currentPage.value = 1;
      await loadWords();
    }
  } catch {
    // Rollback on failure
    localWords.value = prevWords;
    selectedIds.value = prevSelected;
    categorizedCount.value = prevCount;
    unreadTotal.value = prevTotal;
  }
}

// Refresh main store stats when leaving this tab
onUnmounted(() => {
  if (categorizedCount.value > 0) {
    store.loadStats();
    store.loadChartData();
  }
});

onMounted(() => loadWords());
</script>

<style scoped>
.categorizeView {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.catHeader {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.catCount {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.catProgress {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.catEmpty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xl) 0;
  color: var(--color-text-secondary);
  font-size: 14px;
}

.refreshBtn {
  padding: var(--spacing-xs) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  font-size: 13px;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
}

.refreshBtn:hover {
  background-color: var(--color-bg-hover);
}

.catToolbar {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.selectAllLabel {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: 13px;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.selectedInfo {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.catList {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.catItem {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  transition: background-color var(--transition-fast);
}

.catItem:hover {
  background-color: var(--color-bg-hover);
}

.catItem.selected {
  border-color: var(--color-accent);
  background-color: var(--color-bg-hover);
}

.rank {
  font-size: 12px;
  color: var(--color-text-secondary);
  font-family: monospace;
  min-width: 50px;
}

.word {
  font-size: 15px;
  font-weight: 600;
  flex: 1;
  min-width: 0;
}

.itemActions {
  display: flex;
  gap: var(--spacing-xs);
  flex-shrink: 0;
}

.catBtn {
  padding: 2px var(--spacing-sm);
  font-size: 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
}

.catBtn:hover {
  background-color: var(--color-bg-hover);
}

.catBtnPrimary {
  background-color: var(--color-accent);
  color: var(--color-accent-inverse);
  border-color: var(--color-accent);
}

.catBtnPrimary:hover {
  opacity: 0.85;
}

.catPagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md);
}

.pageBtn {
  padding: var(--spacing-xs) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  font-size: 13px;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
}

.pageBtn:hover:not(:disabled) {
  background-color: var(--color-bg-hover);
}

.pageBtn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.pageInfo {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.batchBar {
  position: sticky;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-primary);
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.06);
}

.batchInfo {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.batchActions {
  display: flex;
  gap: var(--spacing-sm);
}

.batchBtn {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  font-size: 13px;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
}

.batchBtn:hover {
  background-color: var(--color-bg-hover);
}

.batchBtnPrimary {
  background-color: var(--color-accent);
  color: var(--color-accent-inverse);
  border-color: var(--color-accent);
}

.batchBtnPrimary:hover {
  opacity: 0.85;
}
</style>
