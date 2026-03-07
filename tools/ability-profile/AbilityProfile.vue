<template>
  <div class="ability-profile">
    <!-- Dashboard view -->
    <template v-if="store.currentView.type === 'dashboard'">
      <div class="dashboard-header">
        <h2 class="page-title">能力画像</h2>
        <BaseButton @click="openAddSkill">添加技能</BaseButton>
      </div>

      <!-- Empty state -->
      <div v-if="!store.loading && store.skills.length === 0" class="empty-state">
        <p class="empty-title">开始追踪你的技能成长</p>
        <p class="empty-desc">添加你想提升的技能，设定里程碑，追踪真实进步</p>
        <BaseButton @click="openAddSkill">添加第一个技能</BaseButton>
      </div>

      <template v-else-if="!store.loading">
        <!-- Radar chart -->
        <RadarChart :points="store.radarData" />

        <!-- Skills list -->
        <div class="skills-section">
          <div class="skills-header">
            <h3 class="section-title">我的技能 ({{ store.activeSkillCount }})</h3>
          </div>
          <div class="skills-grid">
            <SkillCard
              v-for="skill in store.skills"
              :key="skill.id"
              :skill="skill"
              @select="store.switchView({ type: 'skill-detail', skillId: $event })"
            />
          </div>
        </div>
      </template>
    </template>

    <!-- Skill detail view -->
    <template v-else-if="store.currentView.type === 'skill-detail' && store.currentSkill">
      <SkillDetailPage
        :skill="store.currentSkill"
        @back="store.switchView({ type: 'dashboard' })"
        @complete-milestone="openVerifyModal($event)"
        @save-states="handleSaveStates"
        @pause="store.updateSkill(store.currentSkill!.id, { status: 'paused' }).then(() => store.loadSkillDetail(store.currentSkill!.id))"
        @resume="store.updateSkill(store.currentSkill!.id, { status: 'active' }).then(() => store.loadSkillDetail(store.currentSkill!.id))"
        @delete="handleDeleteSkill"
      />
    </template>

    <!-- Add skill modal -->
    <AddSkillModal
      :open="showAddSkill"
      :categories="store.categories"
      :templates="store.templates"
      @close="showAddSkill = false"
      @create="handleCreateSkill"
    />

    <!-- Milestone verify modal -->
    <MilestoneVerifyModal
      :milestone="verifyingMilestone"
      @close="verifyingMilestone = null"
      @submit="handleCompleteMilestone"
    />

    <!-- Tier unlock toast -->
    <div v-if="tierUnlockMessage" class="tier-toast">
      {{ tierUnlockMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Milestone } from './types';
import { TIER_NAMES } from './types';
import { useAbilityStore } from '~/stores/ability';
import RadarChart from './components/RadarChart.vue';
import SkillCard from './components/SkillCard.vue';
import SkillDetailPage from './components/SkillDetailPage.vue';
import AddSkillModal from './components/AddSkillModal.vue';
import MilestoneVerifyModal from './components/MilestoneVerifyModal.vue';

const store = useAbilityStore();

const showAddSkill = ref(false);
const verifyingMilestone = ref<Milestone | null>(null);
const tierUnlockMessage = ref('');

// Load data on mount
onMounted(() => {
  store.loadDashboard();
});

async function openAddSkill() {
  await store.loadTemplates();
  showAddSkill.value = true;
}

async function handleCreateSkill(data: {
  name: string;
  categoryId: number;
  description?: string;
  source: 'template' | 'custom';
  templateId?: string;
}) {
  await store.createSkill(data);
  showAddSkill.value = false;
}

function openVerifyModal(milestone: Milestone) {
  verifyingMilestone.value = milestone;
}

async function handleCompleteMilestone(data: {
  milestoneId: number;
  verifyMethod: string;
  evidenceUrl?: string;
  evidenceNote?: string;
}) {
  if (!store.currentSkill) return;

  const result = await store.completeMilestone(
    store.currentSkill.id,
    data.milestoneId,
    {
      verifyMethod: data.verifyMethod,
      evidenceUrl: data.evidenceUrl,
      evidenceNote: data.evidenceNote,
    },
  );

  verifyingMilestone.value = null;

  if (result.tierUnlocked) {
    tierUnlockMessage.value = `段位解锁：${TIER_NAMES[result.tierUnlocked.newTier]}！`;
    setTimeout(() => { tierUnlockMessage.value = ''; }, 3000);
  }
}

async function handleSaveStates(states: Array<{ stateKey: string; stateValue: string; stateLabel: string }>) {
  if (!store.currentSkill) return;
  await store.updateStates(store.currentSkill.id, states);
}

async function handleDeleteSkill() {
  if (!store.currentSkill) return;
  if (!confirm(`确定删除技能「${store.currentSkill.name}」？所有里程碑记录将被删除。`)) return;
  await store.deleteSkill(store.currentSkill.id);
}
</script>

<style scoped>
.ability-profile {
  max-width: 800px;
  margin: 0 auto;
  padding: var(--spacing-lg);
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
}

.page-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.empty-state {
  text-align: center;
  padding: var(--spacing-xl) var(--spacing-lg);
}

.empty-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-sm);
}

.empty-desc {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-lg);
}

.skills-section {
  margin-top: var(--spacing-lg);
}

.skills-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.skills-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--spacing-md);
}

.tier-toast {
  position: fixed;
  bottom: var(--spacing-xl);
  left: 50%;
  transform: translateX(-50%);
  background-color: var(--color-accent);
  color: var(--color-accent-inverse);
  padding: var(--spacing-sm) var(--spacing-lg);
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 600;
  z-index: 200;
  animation: toast-in 0.3s ease;
}

@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

@media (max-width: 768px) {
  .ability-profile {
    padding: var(--spacing-md);
  }

  .skills-grid {
    grid-template-columns: 1fr;
  }
}
</style>
