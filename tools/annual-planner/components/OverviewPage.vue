<template>
  <div class="overviewPage">
    <GlobalProgress
      v-if="stats"
      :total-goals="stats.totalGoals"
      :total-checkitems="stats.totalCheckitems"
      :completed-checkitems="stats.completedCheckitems"
      :completion-rate="stats.globalCompletionRate"
      :stagnant-goal-count="stats.stagnantGoalCount"
    />

    <div class="domainHeader">
      <h2 class="sectionTitle">领域</h2>
      <BaseButton @click="$emit('createDomain')">新建领域</BaseButton>
    </div>

    <div class="domainGrid">
      <DomainCard
        v-for="domain in domains"
        :key="domain.id"
        :domain="domain"
        @click="$emit('selectDomain', domain.id)"
        @edit="$emit('editDomain', domain)"
        @delete="$emit('deleteDomain', domain)"
        @dragstart="onDragStart($event, domain.id)"
        @dragover="onDragOver($event)"
        @drop="onDrop($event, domain.id)"
      />
    </div>

    <div v-if="domainGoalStats.length > 0" class="goalsByDomain">
      <h2 class="sectionTitle">目标总览</h2>
      <div class="groupList">
        <GroupCard
          v-for="stat in domainGoalStats"
          :key="stat.id"
          :name="stat.name"
          :goal-count="stat.goalCount"
          :completion-rate="stat.completionRate"
          :goals="mapDomainGoals(stat.goals)"
          empty-text="暂无目标"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DomainWithStats, DomainGoalStats, OverviewStats } from '../types';
import GlobalProgress from './GlobalProgress.vue';
import DomainCard from './DomainCard.vue';
import GroupCard from './GroupCard.vue';

const isMobile = useIsMobile();

const props = defineProps<{
  domains: DomainWithStats[];
  stats: OverviewStats | null;
  domainGoalStats: DomainGoalStats[];
}>();

const emit = defineEmits<{
  selectDomain: [id: number];
  createDomain: [];
  editDomain: [domain: DomainWithStats];
  deleteDomain: [domain: DomainWithStats];
  reorderDomains: [items: { id: number; sortOrder: number }[]];
}>();

function mapDomainGoals(goals: DomainGoalStats['goals']) {
  return goals.map(g => ({
    id: g.id,
    title: g.title,
    badge: g.tagNames || undefined,
    completionRate: g.completionRate,
  }));
}

const dragId = ref<number | null>(null);

function onDragStart(e: DragEvent, id: number) {
  if (isMobile.value) return;
  dragId.value = id;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
  }
}

function onDragOver(e: DragEvent) {
  if (isMobile.value) return;
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move';
  }
}

function onDrop(_e: DragEvent, targetId: number) {
  if (isMobile.value) return;
  if (dragId.value === null || dragId.value === targetId) return;

  const items = [...props.domains];
  const dragIdx = items.findIndex(d => d.id === dragId.value);
  const targetIdx = items.findIndex(d => d.id === targetId);
  if (dragIdx === -1 || targetIdx === -1) return;

  const [moved] = items.splice(dragIdx, 1);
  items.splice(targetIdx, 0, moved);

  const reordered = items.map((item, i) => ({ id: item.id, sortOrder: i }));
  emit('reorderDomains', reordered);
  dragId.value = null;
}
</script>

<style scoped>
.overviewPage {
  padding: var(--spacing-lg);
}

.domainHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-md);
}

.sectionTitle {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.domainGrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--spacing-md);
}

.goalsByDomain {
  margin-top: var(--spacing-xl);
}

.goalsByDomain .sectionTitle {
  margin-bottom: var(--spacing-md);
}

.groupList {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

@media (max-width: 768px) {
  .overviewPage {
    padding: var(--spacing-md);
  }
  .domainGrid {
    grid-template-columns: 1fr;
  }
}
</style>
