<template>
  <div class="skill-detail">
    <div class="detail-header">
      <button class="back-btn" @click="$emit('back')">← 返回</button>
      <div class="detail-title-row">
        <h2 class="detail-title">{{ skill.name }}</h2>
        <span class="detail-source" :class="`source-${skill.source}`">
          {{ sourceLabel }}
        </span>
      </div>
      <p v-if="skill.description" class="detail-desc">{{ skill.description }}</p>
    </div>

    <!-- Tier progress -->
    <SkillTierProgress :current-tier="skill.currentTier" />

    <!-- Current states -->
    <CurrentStatePanel
      :states="skill.currentStates"
      @save="$emit('save-states', $event)"
    />

    <!-- Milestones by tier -->
    <div class="milestones-section">
      <div class="milestones-header">
        <h3 class="section-title">里程碑</h3>
        <BaseButton
          v-if="props.skill.milestones.length < 5"
          variant="ghost"
          :disabled="generatingMilestones"
          @click="handleGenerateMilestones"
        >
          {{ generatingMilestones ? '生成中...' : 'AI 生成里程碑' }}
        </BaseButton>
      </div>
      <div v-for="tier in activeTiers" :key="tier" class="tier-group">
        <div class="tier-header">
          <span class="tier-name">{{ TIER_NAMES[tier] }}</span>
          <span class="tier-stars">
            <span v-for="s in tier" :key="s">★</span>
          </span>
          <span class="tier-progress-text">
            {{ completedInTier(tier) }}/{{ milestonesInTier(tier).length }}
          </span>
        </div>
        <div class="tier-milestones">
          <MilestoneItem
            v-for="m in milestonesInTier(tier)"
            :key="m.id"
            :milestone="m"
            :locked="isTierLocked(tier)"
            :has-higher-tier-completed="hasHigherTierCompleted(tier)"
            @complete="$emit('complete-milestone', m)"
            @uncomplete="$emit('uncomplete-milestone', m)"
          />
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="detail-actions">
      <BaseButton
        v-if="skill.status === 'active'"
        variant="ghost"
        @click="$emit('pause')"
      >
        暂停追踪
      </BaseButton>
      <BaseButton
        v-else
        variant="ghost"
        @click="$emit('resume')"
      >
        恢复追踪
      </BaseButton>
      <BaseButton variant="danger" @click="$emit('delete')">删除技能</BaseButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SkillDetail, Milestone } from '../types';
import { TIER_NAMES } from '../types';
import SkillTierProgress from './SkillTierProgress.vue';
import CurrentStatePanel from './CurrentStatePanel.vue';
import MilestoneItem from './MilestoneItem.vue';

const props = defineProps<{
  skill: SkillDetail;
}>();

const emit = defineEmits<{
  back: [];
  'complete-milestone': [milestone: Milestone];
  'uncomplete-milestone': [milestone: Milestone];
  'save-states': [states: Array<{ stateKey: string; stateValue: string; stateLabel: string }>];
  'generate-milestones': [];
  pause: [];
  resume: [];
  delete: [];
}>();

const generatingMilestones = ref(false);

function handleGenerateMilestones() {
  generatingMilestones.value = true;
  emit('generate-milestones');
}

watch(() => props.skill.milestones, () => {
  generatingMilestones.value = false;
});

const sourceLabel = computed(() => {
  switch (props.skill.source) {
    case 'template': return '模板';
    case 'ai': return 'AI';
    case 'custom': return '自定义';
    default: return '';
  }
});

const activeTiers = computed(() => {
  const tiers = new Set(props.skill.milestones.map((m) => m.tier));
  return Array.from(tiers).sort((a, b) => a - b);
});

function milestonesInTier(tier: number): Milestone[] {
  return props.skill.milestones
    .filter((m) => m.tier === tier)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function completedInTier(tier: number): number {
  return milestonesInTier(tier).filter((m) => m.completion !== null).length;
}

function isTierLocked(tier: number): boolean {
  if (tier <= 1) return false;
  const prevTier = tier - 1;
  const prevMilestones = milestonesInTier(prevTier);
  if (prevMilestones.length === 0) return false;
  return prevMilestones.some((m) => m.completion === null);
}

function hasHigherTierCompleted(tier: number): boolean {
  return props.skill.milestones.some(
    (m) => m.tier > tier && m.completion !== null,
  );
}
</script>

<style scoped>
.skill-detail {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.detail-header {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.back-btn {
  align-self: flex-start;
  background: none;
  border: none;
  font-size: 14px;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: var(--spacing-xs) 0;
}

.back-btn:hover {
  color: var(--color-text-primary);
}

.detail-title-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.detail-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.detail-source {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  background-color: var(--color-bg-hover);
  color: var(--color-text-secondary);
}

.detail-desc {
  font-size: 14px;
  color: var(--color-text-secondary);
}

.milestones-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.milestones-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.tier-group {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.tier-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background-color: var(--color-bg-hover);
  border-bottom: 1px solid var(--color-border);
}

.tier-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--color-text-primary);
}

.tier-stars {
  font-size: 12px;
  color: var(--color-accent);
}

.tier-progress-text {
  margin-left: auto;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.tier-milestones {
  padding: 0;
}

.detail-actions {
  display: flex;
  gap: var(--spacing-sm);
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--color-border);
}
</style>
