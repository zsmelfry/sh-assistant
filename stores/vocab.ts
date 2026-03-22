import { defineStore } from 'pinia';
import type {
  WordWithProgress,
  FilterType,
  StatusAction,
  Stats,
  ChartDataPoint,
  WordListResponse,
  ChartRawResponse,
  ImportResponse,
} from '~/tools/vocab-tracker/types';

export const useVocabStore = defineStore('vocab', () => {
  // ===== 词汇状态 =====
  const words = ref<WordWithProgress[]>([]);
  const totalWords = ref(0);
  const filter = ref<FilterType>('all');
  const searchQuery = ref('');
  const page = ref(1);
  const pageSize = ref(20);
  const isLoading = ref(false);
  const hasWords = ref(false);

  const totalPages = computed(() => Math.ceil(totalWords.value / pageSize.value));

  // ===== 选择状态 =====
  const selectedWordIds = ref<Set<number>>(new Set());
  const selectedCount = computed(() => selectedWordIds.value.size);
  const someSelected = computed(() => selectedWordIds.value.size > 0);

  // ===== 统计 & 图表 =====
  const stats = ref<Stats>({ total: 0, unread: 0, toLearn: 0, learning: 0, mastered: 0 });
  const chartData = ref<ChartDataPoint[]>([]);

  // ===== 词汇操作 =====
  async function loadWords() {
    isLoading.value = true;
    try {
      const result = await $fetch<WordListResponse>('/api/vocab/words', {
        params: {
          filter: filter.value,
          search: searchQuery.value,
          page: page.value,
          pageSize: pageSize.value,
        },
      });
      words.value = result.words;
      totalWords.value = result.total;
      hasWords.value = result.total > 0 || filter.value !== 'all';
    } finally {
      isLoading.value = false;
    }
  }

  async function loadStats() {
    const result = await $fetch<Stats>('/api/vocab/stats');
    stats.value = result;
    hasWords.value = result.total > 0;
  }

  async function loadChartData() {
    const result = await $fetch<ChartRawResponse>('/api/vocab/progress/chart');

    // 将后端的 masteredCurve 和 interactedCurve 合并为 ChartDataPoint[]
    const dateMap = new Map<string, ChartDataPoint>();

    for (const item of result.masteredCurve) {
      const existing = dateMap.get(item.date);
      if (existing) {
        existing.masteredCount = item.count;
      } else {
        dateMap.set(item.date, { date: item.date, masteredCount: item.count, readCount: 0 });
      }
    }

    for (const item of result.interactedCurve) {
      const existing = dateMap.get(item.date);
      if (existing) {
        existing.readCount = item.count;
      } else {
        dateMap.set(item.date, { date: item.date, masteredCount: 0, readCount: item.count });
      }
    }

    chartData.value = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  async function initialize() {
    await Promise.all([loadStats(), loadWords(), loadChartData()]);
  }

  async function refreshAll() {
    clearSelection();
    page.value = 1;
    await Promise.all([loadStats(), loadWords(), loadChartData()]);
  }

  // ===== 筛选 & 分页 =====
  async function setFilter(newFilter: FilterType) {
    filter.value = newFilter;
    page.value = 1;
    clearSelection();
    await loadWords();
  }

  async function setSearch(query: string) {
    searchQuery.value = query;
    page.value = 1;
    clearSelection();
    await loadWords();
  }

  async function setPage(newPage: number) {
    if (newPage < 1 || newPage > totalPages.value) return;
    page.value = newPage;
    clearSelection();
    await loadWords();
  }

  // ===== 状态更新 =====
  async function updateWordStatus(wordId: number, action: StatusAction) {
    await $fetch('/api/vocab/progress/status', {
      method: 'POST',
      body: { wordId, action },
    });

    await Promise.all([loadWords(), loadStats(), loadChartData()]);
  }

  async function batchUpdateStatus(action: StatusAction) {
    if (selectedWordIds.value.size === 0) return;

    await $fetch('/api/vocab/progress/batch', {
      method: 'POST',
      body: {
        wordIds: Array.from(selectedWordIds.value),
        action,
      },
    });

    clearSelection();
    await Promise.all([loadWords(), loadStats(), loadChartData()]);
  }

  // ===== CSV 导入 =====
  async function importWords(csv: string) {
    const result = await $fetch<ImportResponse>('/api/vocab/words-import', {
      method: 'POST',
      body: { csv },
    });

    await refreshAll();

    return result;
  }

  // ===== 选择操作 =====
  function toggleSelection(wordId: number) {
    const newSet = new Set(selectedWordIds.value);
    if (newSet.has(wordId)) {
      newSet.delete(wordId);
    } else {
      newSet.add(wordId);
    }
    selectedWordIds.value = newSet;
  }

  function clearSelection() {
    selectedWordIds.value = new Set();
  }

  function isSelected(wordId: number): boolean {
    return selectedWordIds.value.has(wordId);
  }

  // ===== 工具 =====
  function resetWordState() {
    words.value = [];
    totalWords.value = 0;
    stats.value = { total: 0, unread: 0, toLearn: 0, learning: 0, mastered: 0 };
    chartData.value = [];
    hasWords.value = false;
  }

  return {
    // 词汇
    words, totalWords, filter, searchQuery, page, pageSize,
    isLoading, hasWords, totalPages,
    // 选择
    selectedWordIds, selectedCount, someSelected,
    // 统计
    stats, chartData,
    // 词汇操作
    initialize, refreshAll, loadWords, loadStats, loadChartData,
    setFilter, setSearch, setPage,
    updateWordStatus, batchUpdateStatus, importWords,
    // 选择操作
    toggleSelection, clearSelection, isSelected,
  };
});
