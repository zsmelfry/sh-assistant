<template>
  <div class="stageTimeline">
    <StageNode
      v-for="(stage, index) in stages"
      :key="stage.id"
      :stage="stage"
      :index="index"
      :expanded="expandedStageId === stage.id"
      @toggle="handleToggle(stage.id)"
    >
      <StagePointList
        :points="stagePoints"
        :loading="store.stageLoading && expandedStageId === stage.id"
        @navigate-point="(id) => store.navigateToPoint(id)"
      />
    </StageNode>
  </div>
</template>

<script setup lang="ts">
import { SKILL_STORE_KEY } from '~/composables/skill-learning';
import type { StageWithStats } from '~/composables/skill-learning/types';
import StageNode from './StageNode.vue';
import StagePointList from './StagePointList.vue';

defineProps<{
  stages: StageWithStats[];
}>();

const store = inject(SKILL_STORE_KEY)!;
const expandedStageId = ref<number | null>(null);

const stagePoints = computed(() => store.currentStage?.points ?? []);

function handleToggle(stageId: number) {
  if (expandedStageId.value === stageId) {
    expandedStageId.value = null;
  } else {
    expandedStageId.value = stageId;
    store.loadStage(stageId);
  }
}
</script>

<style scoped>
.stageTimeline {
  display: flex;
  flex-direction: column;
  padding-left: var(--spacing-xs);
}
</style>
