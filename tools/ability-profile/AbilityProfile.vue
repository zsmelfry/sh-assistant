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
        <div class="empty-actions">
          <BaseButton @click="openAddSkill">添加第一个技能</BaseButton>
          <BaseButton variant="ghost" @click="store.switchView({ type: 'onboarding' })">AI 快速建档</BaseButton>
        </div>
      </div>

      <template v-else-if="!store.loading">
        <!-- Radar chart -->
        <RadarChart :points="store.radarData" />

        <!-- Focus plans -->
        <div v-if="store.focusPlans.length > 0" class="focus-section">
          <h3 class="section-title">焦点计划</h3>
          <div class="focus-list">
            <FocusPlanCard
              v-for="plan in store.focusPlans"
              :key="plan.id"
              :plan="plan"
              @view-skill="store.switchView({ type: 'skill-detail', skillId: $event })"
              @generate-strategy="handleGenerateStrategy"
              @abandon="handleAbandonPlan"
            />
          </div>
        </div>

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

        <!-- Recent badges -->
        <div v-if="recentBadges.length > 0" class="badges-section">
          <div class="badges-header">
            <h3 class="section-title">最近获得的徽章</h3>
            <BaseButton variant="ghost" @click="store.switchView({ type: 'badges' })">查看全部</BaseButton>
          </div>
          <div class="badges-mini">
            <span v-for="badge in recentBadges" :key="badge.id" class="badge-mini" :title="badge.description">
              🏅 {{ badge.name }}
            </span>
          </div>
        </div>

        <!-- Quick actions -->
        <div class="quick-actions">
          <BaseButton variant="ghost" @click="store.switchView({ type: 'badges' })">荣誉墙</BaseButton>
          <BaseButton variant="ghost" @click="store.switchView({ type: 'growth' })">成长记录</BaseButton>
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
        @generate-milestones="handleGenerateMilestones"
        @pause="store.updateSkill(store.currentSkill!.id, { status: 'paused' }).then(() => store.loadSkillDetail(store.currentSkill!.id))"
        @resume="store.updateSkill(store.currentSkill!.id, { status: 'active' }).then(() => store.loadSkillDetail(store.currentSkill!.id))"
        @delete="handleDeleteSkill"
      />
    </template>

    <!-- Badges view -->
    <template v-else-if="store.currentView.type === 'badges'">
      <BadgeWall
        :badges="store.allBadges"
        @back="store.switchView({ type: 'dashboard' })"
      />
    </template>

    <!-- Growth view -->
    <template v-else-if="store.currentView.type === 'growth'">
      <div class="view-header">
        <BaseButton variant="ghost" @click="store.switchView({ type: 'dashboard' })">← 返回</BaseButton>
        <h2 class="page-title">成长记录</h2>
      </div>
      <GrowthCurve :snapshots="snapshots" :categories="store.categories" />
      <GrowthTimeline />
    </template>

    <!-- Onboarding view -->
    <template v-else-if="store.currentView.type === 'onboarding'">
      <OnboardingChat
        @back="store.switchView({ type: 'dashboard' })"
        @done="handleOnboardingDone"
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
import FocusPlanCard from './components/FocusPlanCard.vue';
import BadgeWall from './components/BadgeWall.vue';
import OnboardingChat from './components/OnboardingChat.vue';
import GrowthCurve from './components/GrowthCurve.vue';
import GrowthTimeline from './components/GrowthTimeline.vue';

const store = useAbilityStore();

const snapshots = ref<any[]>([]);
const showAddSkill = ref(false);
const verifyingMilestone = ref<Milestone | null>(null);
const tierUnlockMessage = ref('');

// Load data on mount
onMounted(() => {
  store.loadDashboard();
});

// Load snapshots when entering growth view
watch(() => store.currentView.type, async (type) => {
  if (type === 'growth') {
    snapshots.value = await store.loadSnapshots();
  }
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

const recentBadges = computed(() =>
  store.allBadges.filter((b) => b.awarded).slice(-3),
);

async function handleGenerateStrategy(planId: number) {
  await store.generateStrategy(planId);
}

async function handleAbandonPlan(planId: number) {
  if (!confirm('确定放弃此焦点计划？')) return;
  await store.updateFocusPlan(planId, { status: 'abandoned' });
}

async function handleOnboardingDone() {
  await store.loadDashboard();
  store.switchView({ type: 'dashboard' });
}

async function handleGenerateMilestones() {
  if (!store.currentSkill) return;
  await store.generateMilestones(store.currentSkill.id);
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

.empty-actions {
  display: flex;
  gap: var(--spacing-sm);
  justify-content: center;
}

.focus-section {
  margin-top: var(--spacing-lg);
}

.focus-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  margin-top: var(--spacing-md);
}

.badges-section {
  margin-top: var(--spacing-lg);
}

.badges-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-sm);
}

.badges-mini {
  display: flex;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}

.badge-mini {
  font-size: 13px;
  padding: var(--spacing-xs) var(--spacing-sm);
  background-color: var(--color-bg-hover);
  border-radius: var(--radius-sm);
}

.quick-actions {
  display: flex;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-lg);
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--color-border);
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

.view-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
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
