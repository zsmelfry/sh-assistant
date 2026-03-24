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
  Wordbook,
} from '~/tools/vocab-tracker/types';
import { LANGUAGE_TTS_MAP, LANGUAGE_DISPLAY_MAP } from '~/tools/vocab-tracker/types';

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

  // ===== 词汇本 =====
  const wordbooks = ref<Wordbook[]>([]);
  const activeWordbookId = ref<number | null>(null);
  const multiWordbookEnabled = ref(false);

  const activeWordbook = computed(() =>
    wordbooks.value.find(wb => wb.id === activeWordbookId.value) ?? null,
  );

  /** TTS locale for the active wordbook's language (e.g. 'fr-FR') */
  const activeLanguageTts = computed(() => {
    const lang = activeWordbook.value?.language ?? 'fr';
    return LANGUAGE_TTS_MAP[lang] ?? 'fr-FR';
  });

  /** Chinese display name for the active wordbook's language (e.g. '法语') */
  const activeLanguageDisplay = computed(() => {
    const lang = activeWordbook.value?.language ?? 'fr';
    return LANGUAGE_DISPLAY_MAP[lang] ?? '法语';
  });

  // ===== 设置 =====
  const interestContext = ref('');

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

  async function loadSettings() {
    try {
      const result = await $fetch<Record<string, string>>('/api/vocab/settings');
      interestContext.value = result.example_interest_context ?? '';
    } catch {
      // Settings are non-critical, don't block initialization
    }
  }

  async function updateInterestContext(value: string) {
    await $fetch('/api/vocab/settings', {
      method: 'PUT',
      body: { key: 'example_interest_context', value },
    });
    interestContext.value = value;
  }

  // ===== 词汇本操作 =====
  async function loadWordbooks() {
    const result = await $fetch<{
      wordbooks: Array<Wordbook & { isActive: number | boolean }>;
      activeWordbookId: number | null;
      multiWordbookEnabled: boolean;
    }>('/api/vocab/wordbooks');

    // API returns isActive as 0/1 integer; convert to boolean
    wordbooks.value = result.wordbooks.map(wb => ({
      ...wb,
      isActive: !!wb.isActive,
    }));
    activeWordbookId.value = result.activeWordbookId;
    multiWordbookEnabled.value = result.multiWordbookEnabled;
  }

  async function switchWordbook(id: number) {
    await $fetch(`/api/vocab/wordbooks/${id}/activate`, { method: 'POST' });
    activeWordbookId.value = id;
    wordbooks.value = wordbooks.value.map(wb => ({
      ...wb,
      isActive: wb.id === id,
    }));
    // Reload all data for the new active wordbook
    page.value = 1;
    filter.value = 'all';
    searchQuery.value = '';
    clearSelection();
    await Promise.all([loadStats(), loadWords(), loadChartData()]);
  }

  async function createWordbook(name: string, language: string) {
    await $fetch('/api/vocab/wordbooks', {
      method: 'POST',
      body: { name, language },
    });
    await loadWordbooks();
  }

  async function deleteWordbook(id: number) {
    await $fetch(`/api/vocab/wordbooks/${id}`, { method: 'DELETE' });
    await loadWordbooks();
  }

  async function initialize() {
    await loadWordbooks();
    await Promise.all([loadStats(), loadWords(), loadChartData(), loadSettings()]);
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
  async function importWords(csv: string, wordbookName?: string, language?: string) {
    const result = await $fetch<ImportResponse>('/api/vocab/words-import', {
      method: 'POST',
      body: { csv, wordbookName, language },
    });

    // Reload wordbooks since import may create a new one
    await loadWordbooks();
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
    // 词汇本
    wordbooks, activeWordbookId, multiWordbookEnabled,
    activeWordbook, activeLanguageTts, activeLanguageDisplay,
    // 选择
    selectedWordIds, selectedCount, someSelected,
    // 设置
    interestContext,
    // 统计
    stats, chartData,
    // 词汇本操作
    loadWordbooks, switchWordbook, createWordbook, deleteWordbook,
    // 词汇操作
    initialize, refreshAll, loadWords, loadStats, loadChartData,
    setFilter, setSearch, setPage,
    updateWordStatus, batchUpdateStatus, importWords,
    // 设置操作
    loadSettings, updateInterestContext,
    // 选择操作
    toggleSelection, clearSelection, isSelected,
  };
});
