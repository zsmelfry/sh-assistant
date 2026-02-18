import { defineStore } from 'pinia';
import type {
  User,
  WordWithProgress,
  FilterType,
  StatusAction,
  Stats,
  ChartDataPoint,
  UsersResponse,
  WordListResponse,
  ChartRawResponse,
  ImportResponse,
} from '~/tools/vocab-tracker/types';

const LAST_USER_KEY = 'vocab-last-user-id';

export const useVocabStore = defineStore('vocab', () => {
  // ===== 用户状态 =====
  const users = ref<User[]>([]);
  const currentUserId = ref<number | null>(null);

  const currentUser = computed(() =>
    users.value.find(u => u.id === currentUserId.value) ?? null,
  );
  const hasUsers = computed(() => users.value.length > 0);

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

  // ===== 用户操作 =====
  async function loadUsers(): Promise<number | null> {
    const result = await $fetch<UsersResponse>('/api/vocab/users');
    users.value = result.users;
    return result.lastUserId;
  }

  async function initializeUser() {
    const lastUserId = await loadUsers();

    // 优先使用服务端记录的 lastUserId，其次 localStorage，最后取第一个用户
    if (lastUserId && users.value.some(u => u.id === lastUserId)) {
      currentUserId.value = lastUserId;
    } else {
      const localId = Number(localStorage.getItem(LAST_USER_KEY));
      if (localId && users.value.some(u => u.id === localId)) {
        currentUserId.value = localId;
      } else if (users.value.length > 0) {
        currentUserId.value = users.value[0].id;
      }
    }
  }

  async function switchUser(userId: number) {
    currentUserId.value = userId;
    localStorage.setItem(LAST_USER_KEY, String(userId));
    await refreshAll();
  }

  async function createUser(nickname: string) {
    const user = await $fetch<User>('/api/vocab/users', {
      method: 'POST',
      body: { nickname },
    });
    users.value.push(user);
    // 后端已自动设置 lastUserId，前端也同步
    currentUserId.value = user.id;
    localStorage.setItem(LAST_USER_KEY, String(user.id));
    await refreshAll();
    return user;
  }

  async function deleteUser(userId: number) {
    await $fetch(`/api/vocab/users/${userId}`, { method: 'DELETE' });
    users.value = users.value.filter(u => u.id !== userId);
    if (currentUserId.value === userId) {
      currentUserId.value = users.value[0]?.id ?? null;
      if (currentUserId.value) {
        localStorage.setItem(LAST_USER_KEY, String(currentUserId.value));
        await refreshAll();
      } else {
        localStorage.removeItem(LAST_USER_KEY);
        resetWordState();
      }
    }
  }

  // ===== 词汇操作 =====
  async function loadWords() {
    if (!currentUserId.value) return;
    isLoading.value = true;
    try {
      const result = await $fetch<WordListResponse>('/api/vocab/words', {
        params: {
          userId: currentUserId.value,
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
    if (!currentUserId.value) return;
    const result = await $fetch<Stats>('/api/vocab/stats', {
      params: { userId: currentUserId.value },
    });
    stats.value = result;
    hasWords.value = result.total > 0;
  }

  async function loadChartData() {
    if (!currentUserId.value) return;
    const result = await $fetch<ChartRawResponse>('/api/vocab/progress/chart', {
      params: { userId: currentUserId.value },
    });

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
    await initializeUser();
    if (currentUserId.value) {
      await Promise.all([loadStats(), loadWords(), loadChartData()]);
    }
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
    if (!currentUserId.value) return;

    await $fetch('/api/vocab/progress/status', {
      method: 'POST',
      body: { userId: currentUserId.value, wordId, action },
    });

    await Promise.all([loadWords(), loadStats(), loadChartData()]);
  }

  async function batchUpdateStatus(action: StatusAction) {
    if (!currentUserId.value || selectedWordIds.value.size === 0) return;

    await $fetch('/api/vocab/progress/batch', {
      method: 'POST',
      body: {
        userId: currentUserId.value,
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

    if (currentUserId.value) {
      await refreshAll();
    }

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
    // 用户
    users, currentUserId, currentUser, hasUsers,
    // 词汇
    words, totalWords, filter, searchQuery, page, pageSize,
    isLoading, hasWords, totalPages,
    // 选择
    selectedWordIds, selectedCount, someSelected,
    // 统计
    stats, chartData,
    // 用户操作
    loadUsers, switchUser, createUser, deleteUser,
    // 词汇操作
    initialize, refreshAll, loadWords, loadStats, loadChartData,
    setFilter, setSearch, setPage,
    updateWordStatus, batchUpdateStatus, importWords,
    // 选择操作
    toggleSelection, clearSelection, isSelected,
  };
});
