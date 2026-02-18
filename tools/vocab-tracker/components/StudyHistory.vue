<template>
  <div class="studyHistory">
    <!-- Search bar -->
    <div class="searchBar">
      <input
        v-model="searchQuery"
        type="text"
        class="searchInput"
        placeholder="搜索单词或释义..."
      />
    </div>

    <!-- Filter tabs -->
    <div class="filterTabs">
      <button
        v-for="f in filters"
        :key="f.key"
        class="filterTab"
        :class="{ active: activeFilter === f.key }"
        @click="activeFilter = f.key"
      >
        {{ f.label }}
        <span class="filterCount">({{ filterCounts[f.key] }})</span>
      </button>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="loadingState">加载中...</div>

    <!-- Word list -->
    <div v-else-if="filteredList.length > 0" class="wordList">
      <div
        v-for="item in paginatedList"
        :key="item.cardId"
        class="wordItem"
        @click="openDetail(item)"
      >
        <span class="wordRank">#{{ item.rank }}</span>
        <div class="wordInfo">
          <div class="wordNameRow">
            <span class="wordName">{{ item.word }}</span>
            <span class="stageTag" :class="'stage-' + item.stage">
              {{ stageLabels[item.stage] }}
            </span>
          </div>
          <p v-if="item.definition" class="wordDef">{{ item.definition }}</p>
        </div>
        <div class="srsInfo">
          <span class="intervalText">间隔 {{ item.interval }}天</span>
          <span class="nextReview">下次 {{ formatNextReview(item.nextReviewAt) }}</span>
        </div>
        <button class="detailBtn" @click.stop="openDetail(item)">详情</button>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="pagination">
        <button class="pageBtn" :disabled="currentPage <= 1" @click="currentPage--">
          上一页
        </button>
        <span class="pageInfo">{{ currentPage }} / {{ totalPages }}</span>
        <button class="pageBtn" :disabled="currentPage >= totalPages" @click="currentPage++">
          下一页
        </button>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="emptyState">
      <p>{{ searchQuery ? '未找到匹配的单词' : '暂无学习记录，请先开始背单词' }}</p>
    </div>

    <!-- Word detail modal -->
    <WordDetailModal
      :open="showDetail"
      :word="selectedWord"
      @close="showDetail = false"
    />
  </div>
</template>

<script setup lang="ts">
import WordDetailModal from './WordDetailModal.vue';

type SrsStage = 'all' | 'due' | 'beginner' | 'consolidating' | 'mastered';

interface CardItem {
  cardId: number;
  wordId: number;
  word: string;
  rank: number;
  interval: number;
  nextReviewAt: number;
  stage: string;
  definition?: string;
}

const vocabStore = useVocabStore();

const activeFilter = ref<SrsStage>('all');
const searchQuery = ref('');
const currentPage = ref(1);
const pageSize = 20;
const isLoading = ref(false);
const wordList = ref<CardItem[]>([]);

// Detail modal
const showDetail = ref(false);
const selectedWord = ref<{ word: string; rank: number; wordId: number } | null>(null);

const filters: Array<{ key: SrsStage; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'due', label: '待复习' },
  { key: 'beginner', label: '初学' },
  { key: 'consolidating', label: '巩固中' },
  { key: 'mastered', label: '已掌握' },
];

const stageLabels: Record<string, string> = {
  due: '待复习',
  beginner: '初学',
  consolidating: '巩固中',
  mastered: '已掌握',
};

const filterCounts = computed(() => {
  const counts: Record<SrsStage, number> = { all: 0, due: 0, beginner: 0, consolidating: 0, mastered: 0 };
  counts.all = wordList.value.length;
  for (const item of wordList.value) {
    const stage = item.stage as SrsStage;
    if (stage in counts) counts[stage]++;
  }
  return counts;
});

const filteredList = computed(() => {
  let list = wordList.value;

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase();
    list = list.filter(item =>
      item.word.toLowerCase().includes(q) ||
      (item.definition || '').toLowerCase().includes(q),
    );
  }

  if (activeFilter.value !== 'all') {
    list = list.filter(item => item.stage === activeFilter.value);
  }

  return list;
});

const totalPages = computed(() => Math.ceil(filteredList.value.length / pageSize));

const paginatedList = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  return filteredList.value.slice(start, start + pageSize);
});

watch(activeFilter, () => { currentPage.value = 1; });
watch(searchQuery, () => { currentPage.value = 1; });

function formatNextReview(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function openDetail(item: CardItem) {
  selectedWord.value = { word: item.word, rank: item.rank, wordId: item.wordId };
  showDetail.value = true;
}

async function loadCards() {
  if (!vocabStore.currentUserId) return;
  isLoading.value = true;
  try {
    const cards = await $fetch<CardItem[]>('/api/vocab/srs/cards', {
      params: { userId: vocabStore.currentUserId },
    });
    wordList.value = cards;
  } catch {
    wordList.value = [];
  } finally {
    isLoading.value = false;
  }
}

onMounted(loadCards);
</script>

<style scoped>
.studyHistory {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.searchBar {
  display: flex;
}

.searchInput {
  flex: 1;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
}

.searchInput:focus {
  outline: none;
  border-color: var(--color-accent);
}

.filterTabs {
  display: flex;
  gap: var(--spacing-xs);
  flex-wrap: wrap;
}

.filterTab {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: 20px;
  background: var(--color-bg-primary);
  font-size: 12px;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
}

.filterTab:hover {
  background-color: var(--color-bg-hover);
}

.filterTab.active {
  background-color: var(--color-accent);
  color: var(--color-accent-inverse);
  border-color: var(--color-accent);
}

.filterCount {
  opacity: 0.75;
  margin-left: 2px;
}

.loadingState {
  text-align: center;
  padding: var(--spacing-xl) 0;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.wordList {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.wordItem {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background-color var(--transition-fast);
}

.wordItem:hover {
  background-color: var(--color-bg-hover);
}

.wordRank {
  font-size: 12px;
  color: var(--color-text-disabled);
  font-family: monospace;
  min-width: 40px;
  text-align: right;
}

.wordInfo {
  flex: 1;
  min-width: 0;
}

.wordNameRow {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.wordName {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.stageTag {
  padding: 1px 6px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 500;
}

.stage-due {
  border: 1px solid var(--color-danger);
  color: var(--color-danger);
}

.stage-beginner {
  border: 1px solid var(--color-text-secondary);
  color: var(--color-text-secondary);
}

.stage-consolidating {
  border: 1px solid var(--color-accent);
  color: var(--color-accent);
}

.stage-mastered {
  border: 1px solid var(--color-text-disabled);
  color: var(--color-text-disabled);
}

.wordDef {
  font-size: 12px;
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.srsInfo {
  text-align: right;
  flex-shrink: 0;
}

.intervalText {
  display: block;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.nextReview {
  font-size: 10px;
  color: var(--color-text-disabled);
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-sm);
  padding-top: var(--spacing-md);
}

.pageBtn {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  font-size: 12px;
  cursor: pointer;
  color: var(--color-text-secondary);
}

.pageBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pageBtn:hover:not(:disabled) {
  background-color: var(--color-bg-hover);
}

.pageInfo {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.detailBtn {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  font-size: 12px;
  color: var(--color-text-secondary);
  cursor: pointer;
  flex-shrink: 0;
  transition: all var(--transition-fast);
}

.detailBtn:hover {
  background-color: var(--color-bg-hover);
  border-color: var(--color-accent);
  color: var(--color-text-primary);
}

.emptyState {
  text-align: center;
  padding: var(--spacing-xl) 0;
  font-size: 13px;
  color: var(--color-text-disabled);
}
</style>
