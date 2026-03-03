import { defineStore } from 'pinia';
import type {
  PlannerView,
  DomainWithStats,
  GoalWithDetails,
  PlannerTag,
  OverviewStats,
  TagStats,
  DomainGoalStats,
  CreateGoalData,
  UpdateGoalData,
} from '~/tools/annual-planner/types';
import { DEFAULT_DOMAINS } from '~/tools/annual-planner/types';

export const usePlannerStore = defineStore('planner', () => {
  // ===== 状态 =====
  const selectedYear = ref(new Date().getFullYear());
  const availableYears = ref<number[]>([]);
  const domains = ref<DomainWithStats[]>([]);
  const currentView = ref<PlannerView>({ type: 'overview' });
  const goals = ref<GoalWithDetails[]>([]);
  const tags = ref<PlannerTag[]>([]);
  const overviewStats = ref<OverviewStats | null>(null);
  const tagStats = ref<TagStats[]>([]);
  const domainGoalStats = ref<DomainGoalStats[]>([]);
  const loading = ref(false);

  // ===== 计算属性 =====
  const currentDomain = computed(() => {
    const view = currentView.value;
    if (view.type !== 'domain') return null;
    return domains.value.find(d => d.id === view.domainId) ?? null;
  });

  const globalCompletionRate = computed(() =>
    overviewStats.value?.globalCompletionRate ?? 0,
  );

  // ===== 辅助 =====
  async function reloadCurrentDomainGoals(): Promise<void> {
    if (currentView.value.type === 'domain') {
      await loadGoals(currentView.value.domainId);
    }
  }

  // ===== 导航 =====
  function navigateTo(view: PlannerView) {
    currentView.value = view;
    if (view.type === 'domain') {
      loadGoals(view.domainId);
    } else if (view.type === 'tags') {
      loadTagStats();
    } else if (view.type === 'overview') {
      loadOverview();
      loadDomainGoalStats();
    }
  }

  // ===== 年份操作 =====
  async function loadAvailableYears() {
    availableYears.value = await $fetch<number[]>('/api/planner/domains/years');
  }

  async function setYear(year: number) {
    selectedYear.value = year;
    currentView.value = { type: 'overview' };
    await loadDomains();
    if (domains.value.length > 0) {
      await Promise.all([loadOverview(), loadDomainGoalStats()]);
    }
  }

  async function copyYearStructure(sourceYear: number) {
    await $fetch('/api/planner/domains/copy-year', {
      method: 'POST',
      body: { sourceYear, targetYear: selectedYear.value },
    });
    await Promise.all([loadAvailableYears(), loadDomains()]);
    await Promise.all([loadOverview(), loadDomainGoalStats()]);
  }

  // ===== 领域操作 =====
  async function loadDomains() {
    domains.value = await $fetch<DomainWithStats[]>('/api/planner/domains', {
      params: { year: selectedYear.value },
    });
  }

  async function createDomain(name: string) {
    await $fetch('/api/planner/domains', {
      method: 'POST',
      body: { name, year: selectedYear.value },
    });
    await loadDomains();
  }

  async function updateDomain(id: number, name: string) {
    await $fetch(`/api/planner/domains/${id}`, {
      method: 'PUT',
      body: { name },
    });
    await loadDomains();
  }

  async function deleteDomain(id: number) {
    await $fetch(`/api/planner/domains/${id}`, { method: 'DELETE' });
    await loadDomains();
    if (currentView.value.type === 'domain' && currentView.value.domainId === id) {
      navigateTo({ type: 'overview' });
    }
  }

  async function reorderDomains(items: { id: number; sortOrder: number }[]) {
    // Optimistic update
    const sorted = [...domains.value];
    for (const item of items) {
      const domain = sorted.find(d => d.id === item.id);
      if (domain) domain.sortOrder = item.sortOrder;
    }
    domains.value = sorted.sort((a, b) => a.sortOrder - b.sortOrder);

    await $fetch('/api/planner/domains/reorder', {
      method: 'PUT',
      body: { items },
    });
  }

  async function initializeDefaults() {
    await Promise.all(DEFAULT_DOMAINS.map(name =>
      $fetch('/api/planner/domains', {
        method: 'POST',
        body: { name, year: selectedYear.value },
      }),
    ));
    await Promise.all([loadAvailableYears(), loadDomains()]);
    await Promise.all([loadOverview(), loadDomainGoalStats()]);
  }

  // ===== 目标操作 =====
  async function loadGoals(domainId: number) {
    goals.value = await $fetch<GoalWithDetails[]>('/api/planner/goals', {
      params: { domainId },
    });
  }

  async function createGoal(data: CreateGoalData) {
    await $fetch('/api/planner/goals', {
      method: 'POST',
      body: data,
    });
    await Promise.all([loadGoals(data.domainId), loadDomains()]);
  }

  async function updateGoal(id: number, data: UpdateGoalData) {
    await $fetch(`/api/planner/goals/${id}`, {
      method: 'PUT',
      body: data,
    });
    await Promise.all([reloadCurrentDomainGoals(), loadDomains()]);
  }

  async function deleteGoal(id: number) {
    await $fetch(`/api/planner/goals/${id}`, { method: 'DELETE' });
    await Promise.all([reloadCurrentDomainGoals(), loadDomains()]);
  }

  async function reorderGoals(items: { id: number; sortOrder: number }[]) {
    // Optimistic update
    const sorted = [...goals.value];
    for (const item of items) {
      const goal = sorted.find(g => g.id === item.id);
      if (goal) goal.sortOrder = item.sortOrder;
    }
    goals.value = sorted.sort((a, b) => a.sortOrder - b.sortOrder);

    await $fetch('/api/planner/goals/reorder', {
      method: 'PUT',
      body: { items },
    });
  }

  // ===== 检查项操作 =====
  async function createCheckitem(goalId: number, content: string) {
    await $fetch('/api/planner/checkitems', {
      method: 'POST',
      body: { goalId, content },
    });
    await Promise.all([reloadCurrentDomainGoals(), loadDomains()]);
  }

  async function updateCheckitem(id: number, content: string) {
    await $fetch(`/api/planner/checkitems/${id}`, {
      method: 'PUT',
      body: { content },
    });
    await reloadCurrentDomainGoals();
  }

  async function deleteCheckitem(id: number) {
    await $fetch(`/api/planner/checkitems/${id}`, { method: 'DELETE' });
    await Promise.all([reloadCurrentDomainGoals(), loadDomains()]);
  }

  async function toggleCheckitem(id: number) {
    // Optimistic update
    const goal = goals.value.find(g => g.checkitems.some(c => c.id === id));
    if (!goal) return;

    const item = goal.checkitems.find(c => c.id === id);
    if (!item) return;

    const wasCompleted = item.isCompleted;
    item.isCompleted = !wasCompleted;
    item.completedAt = wasCompleted ? null : Date.now();
    goal.completedCheckitems += wasCompleted ? -1 : 1;

    try {
      await $fetch('/api/planner/checkitems/toggle', {
        method: 'POST',
        body: { id },
      });
      await loadDomains();
    } catch {
      // Rollback on failure
      await Promise.all([reloadCurrentDomainGoals(), loadDomains()]);
    }
  }

  async function reorderCheckitems(items: { id: number; sortOrder: number }[]) {
    await $fetch('/api/planner/checkitems/reorder', {
      method: 'PUT',
      body: { items },
    });
    await reloadCurrentDomainGoals();
  }

  // ===== 标签操作 =====
  async function loadTags() {
    tags.value = await $fetch<PlannerTag[]>('/api/planner/tags');
  }

  async function createTag(name: string) {
    const tag = await $fetch<PlannerTag>('/api/planner/tags', {
      method: 'POST',
      body: { name },
    });
    await loadTags();
    if (currentView.value.type === 'tags') {
      await loadTagStats();
    }
    return tag;
  }

  async function reloadCurrentViewAfterTagChange(): Promise<void> {
    if (currentView.value.type === 'tags') {
      await loadTagStats();
    } else {
      await reloadCurrentDomainGoals();
    }
  }

  async function updateTag(id: number, name: string) {
    await $fetch(`/api/planner/tags/${id}`, {
      method: 'PUT',
      body: { name },
    });
    await loadTags();
    await reloadCurrentViewAfterTagChange();
  }

  async function deleteTag(id: number) {
    await $fetch(`/api/planner/tags/${id}`, { method: 'DELETE' });
    await loadTags();
    await reloadCurrentViewAfterTagChange();
  }

  // ===== 统计 =====
  async function loadOverview() {
    overviewStats.value = await $fetch<OverviewStats>('/api/planner/stats/overview', {
      params: { year: selectedYear.value },
    });
    domains.value = overviewStats.value.domains;
  }

  async function loadTagStats() {
    tagStats.value = await $fetch<TagStats[]>('/api/planner/stats/by-tag', {
      params: { year: selectedYear.value },
    });
  }

  async function loadDomainGoalStats() {
    domainGoalStats.value = await $fetch<DomainGoalStats[]>('/api/planner/stats/by-domain', {
      params: { year: selectedYear.value },
    });
  }

  return {
    // 状态
    selectedYear, availableYears,
    domains, currentView, goals, tags, overviewStats, tagStats, domainGoalStats, loading,
    // 计算属性
    currentDomain, globalCompletionRate,
    // 导航
    navigateTo,
    // 年份操作
    loadAvailableYears, setYear, copyYearStructure,
    // 领域操作
    loadDomains, createDomain, updateDomain, deleteDomain,
    reorderDomains, initializeDefaults,
    // 目标操作
    loadGoals, createGoal, updateGoal, deleteGoal, reorderGoals,
    // 检查项操作
    createCheckitem, updateCheckitem, deleteCheckitem,
    toggleCheckitem, reorderCheckitems,
    // 标签操作
    loadTags, createTag, updateTag, deleteTag,
    // 统计
    loadOverview, loadTagStats, loadDomainGoalStats,
  };
});
