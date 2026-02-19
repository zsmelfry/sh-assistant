import { defineStore } from 'pinia';
import type {
  PlannerView,
  DomainWithStats,
  GoalWithDetails,
  PlannerTag,
  PlannerCheckitem,
  OverviewStats,
  TagStats,
  CreateGoalData,
  UpdateGoalData,
} from '~/tools/annual-planner/types';
import { DEFAULT_DOMAINS } from '~/tools/annual-planner/types';

export const usePlannerStore = defineStore('planner', () => {
  // ===== 状态 =====
  const domains = ref<DomainWithStats[]>([]);
  const currentView = ref<PlannerView>({ type: 'overview' });
  const goals = ref<GoalWithDetails[]>([]);
  const tags = ref<PlannerTag[]>([]);
  const overviewStats = ref<OverviewStats | null>(null);
  const tagStats = ref<TagStats[]>([]);
  const loading = ref(false);

  // ===== 计算属性 =====
  const currentDomain = computed(() => {
    const view = currentView.value;
    if (view.type !== 'domain') return null;
    return domains.value.find(d => d.id === view.domainId) ?? null;
  });

  const globalCompletionRate = computed(() => {
    if (!overviewStats.value) return 0;
    return overviewStats.value.globalCompletionRate;
  });

  // ===== 导航 =====
  function navigateTo(view: PlannerView) {
    currentView.value = view;
    if (view.type === 'domain') {
      loadGoals(view.domainId);
    } else if (view.type === 'tags') {
      loadTagStats();
    }
  }

  // ===== 领域操作 =====
  async function loadDomains() {
    domains.value = await $fetch<DomainWithStats[]>('/api/planner/domains');
  }

  async function createDomain(name: string) {
    await $fetch('/api/planner/domains', {
      method: 'POST',
      body: { name },
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
    for (const name of DEFAULT_DOMAINS) {
      await $fetch('/api/planner/domains', {
        method: 'POST',
        body: { name },
      });
    }
    await loadDomains();
    await loadOverview();
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
    await loadGoals(data.domainId);
    await loadDomains();
  }

  async function updateGoal(id: number, data: UpdateGoalData) {
    await $fetch(`/api/planner/goals/${id}`, {
      method: 'PUT',
      body: data,
    });
    if (currentView.value.type === 'domain') {
      await loadGoals(currentView.value.domainId);
    }
    await loadDomains();
  }

  async function deleteGoal(id: number) {
    await $fetch(`/api/planner/goals/${id}`, { method: 'DELETE' });
    if (currentView.value.type === 'domain') {
      await loadGoals(currentView.value.domainId);
    }
    await loadDomains();
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
    if (currentView.value.type === 'domain') {
      await loadGoals(currentView.value.domainId);
    }
    await loadDomains();
  }

  async function updateCheckitem(id: number, content: string) {
    await $fetch(`/api/planner/checkitems/${id}`, {
      method: 'PUT',
      body: { content },
    });
    if (currentView.value.type === 'domain') {
      await loadGoals(currentView.value.domainId);
    }
  }

  async function deleteCheckitem(id: number) {
    await $fetch(`/api/planner/checkitems/${id}`, { method: 'DELETE' });
    if (currentView.value.type === 'domain') {
      await loadGoals(currentView.value.domainId);
    }
    await loadDomains();
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
      if (currentView.value.type === 'domain') {
        await loadGoals(currentView.value.domainId);
      }
      await loadDomains();
    }
  }

  async function reorderCheckitems(items: { id: number; sortOrder: number }[]) {
    await $fetch('/api/planner/checkitems/reorder', {
      method: 'PUT',
      body: { items },
    });
    if (currentView.value.type === 'domain') {
      await loadGoals(currentView.value.domainId);
    }
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
    return tag;
  }

  async function updateTag(id: number, name: string) {
    await $fetch(`/api/planner/tags/${id}`, {
      method: 'PUT',
      body: { name },
    });
    await loadTags();
    if (currentView.value.type === 'domain') {
      await loadGoals(currentView.value.domainId);
    }
  }

  async function deleteTag(id: number) {
    await $fetch(`/api/planner/tags/${id}`, { method: 'DELETE' });
    await loadTags();
    if (currentView.value.type === 'domain') {
      await loadGoals(currentView.value.domainId);
    }
  }

  // ===== 统计 =====
  async function loadOverview() {
    overviewStats.value = await $fetch<OverviewStats>('/api/planner/stats/overview');
    domains.value = overviewStats.value.domains;
  }

  async function loadTagStats() {
    tagStats.value = await $fetch<TagStats[]>('/api/planner/stats/by-tag');
  }

  return {
    // 状态
    domains, currentView, goals, tags, overviewStats, tagStats, loading,
    // 计算属性
    currentDomain, globalCompletionRate,
    // 导航
    navigateTo,
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
    loadOverview, loadTagStats,
  };
});
