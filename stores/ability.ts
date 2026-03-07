import { defineStore } from 'pinia';
import type {
  AbilityCategory,
  Skill,
  SkillDetail,
  RadarPoint,
  SkillTemplate,
  AbilityView,
} from '~/tools/ability-profile/types';

export const useAbilityStore = defineStore('ability', () => {
  // ===== State =====
  const categories = ref<AbilityCategory[]>([]);
  const skills = ref<Skill[]>([]);
  const radarData = ref<RadarPoint[]>([]);
  const templates = ref<SkillTemplate[]>([]);
  const currentSkill = ref<SkillDetail | null>(null);
  const currentView = ref<AbilityView>({ type: 'dashboard' });
  const loading = ref(false);

  // ===== Computed =====
  const skillsByCategory = computed(() => {
    const map = new Map<number, Skill[]>();
    for (const s of skills.value) {
      if (!map.has(s.categoryId)) map.set(s.categoryId, []);
      map.get(s.categoryId)!.push(s);
    }
    return map;
  });

  const activeSkillCount = computed(() =>
    skills.value.filter((s) => s.status === 'active').length,
  );

  // ===== Navigation =====
  function switchView(view: AbilityView) {
    currentView.value = view;
    if (view.type === 'skill-detail') {
      loadSkillDetail(view.skillId);
    }
  }

  // ===== Data Loading =====
  async function loadCategories() {
    categories.value = await $fetch<AbilityCategory[]>('/api/ability-categories');
  }

  async function loadSkills() {
    skills.value = await $fetch<Skill[]>('/api/ability-skills');
  }

  async function loadRadar() {
    radarData.value = await $fetch<RadarPoint[]>('/api/ability-stats/radar');
  }

  async function loadTemplates() {
    if (templates.value.length > 0) return;
    templates.value = await $fetch<SkillTemplate[]>('/api/skill-templates');
  }

  async function loadSkillDetail(skillId: number) {
    loading.value = true;
    try {
      currentSkill.value = await $fetch<SkillDetail>(`/api/ability-skills/${skillId}`);
    } finally {
      loading.value = false;
    }
  }

  async function loadDashboard() {
    loading.value = true;
    try {
      await Promise.all([loadCategories(), loadSkills(), loadRadar()]);
    } finally {
      loading.value = false;
    }
  }

  // ===== Skill CRUD =====
  async function createSkill(data: {
    name: string;
    categoryId: number;
    description?: string;
    source: 'template' | 'ai' | 'custom';
    templateId?: string;
  }) {
    const created = await $fetch<Skill>('/api/ability-skills', {
      method: 'POST',
      body: data,
    });
    await Promise.all([loadSkills(), loadRadar()]);
    return created;
  }

  async function updateSkill(id: number, data: Partial<{ name: string; description: string; status: string }>) {
    const updated = await $fetch(`/api/ability-skills/${id}`, {
      method: 'PATCH',
      body: data,
    });
    await loadSkills();
    return updated;
  }

  async function deleteSkill(id: number) {
    await $fetch(`/api/ability-skills/${id}`, { method: 'DELETE' });
    await Promise.all([loadSkills(), loadRadar()]);
    if (currentSkill.value?.id === id) {
      currentSkill.value = null;
      switchView({ type: 'dashboard' });
    }
  }

  // ===== Milestone =====
  async function completeMilestone(
    skillId: number,
    milestoneId: number,
    data?: { verifyMethod?: string; evidenceUrl?: string; evidenceNote?: string },
  ) {
    const result = await $fetch<{
      completion: Record<string, unknown>;
      tierUnlocked: { unlocked: boolean; newTier: number } | null;
    }>(`/api/ability-skills/${skillId}/milestones/${milestoneId}/complete`, {
      method: 'POST',
      body: data || {},
    });

    // Reload skill detail and radar
    await Promise.all([
      loadSkillDetail(skillId),
      loadSkills(),
      loadRadar(),
    ]);

    return result;
  }

  async function addMilestone(
    skillId: number,
    data: { title: string; tier: number; milestoneType: string; verifyMethod: string; description?: string; verifyConfig?: Record<string, unknown> },
  ) {
    await $fetch(`/api/ability-skills/${skillId}/milestones`, {
      method: 'POST',
      body: data,
    });
    await loadSkillDetail(skillId);
  }

  async function deleteMilestone(skillId: number, milestoneId: number) {
    await $fetch(`/api/ability-skills/${skillId}/milestones/${milestoneId}`, {
      method: 'DELETE',
    });
    await loadSkillDetail(skillId);
  }

  // ===== States =====
  async function updateStates(
    skillId: number,
    states: Array<{ stateKey: string; stateValue: string; stateLabel: string; source?: string }>,
  ) {
    await $fetch(`/api/ability-skills/${skillId}/states`, {
      method: 'PUT',
      body: { states },
    });
    await loadSkillDetail(skillId);
  }

  return {
    // State
    categories,
    skills,
    radarData,
    templates,
    currentSkill,
    currentView,
    loading,
    // Computed
    skillsByCategory,
    activeSkillCount,
    // Navigation
    switchView,
    // Loading
    loadCategories,
    loadSkills,
    loadRadar,
    loadTemplates,
    loadSkillDetail,
    loadDashboard,
    // Skills
    createSkill,
    updateSkill,
    deleteSkill,
    // Milestones
    completeMilestone,
    addMilestone,
    deleteMilestone,
    // States
    updateStates,
  };
});
