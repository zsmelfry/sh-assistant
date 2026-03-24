<template>
  <div class="skillTool">
    <!-- Breadcrumb -->
    <nav class="breadcrumb">
      <span
        class="crumb"
        :class="{ clickable: store.currentView !== 'global' }"
        @click="store.currentView !== 'global' && store.navigateToGlobal()"
      >
        全局视图
      </span>
      <template v-if="showDomainCrumb">
        <span class="separator">/</span>
        <span
          class="crumb"
          :class="{ clickable: store.currentView === 'point' }"
          @click="store.currentView === 'point' && store.navigateToDomain(store.currentDomainId!)"
        >
          {{ store.breadcrumbDomainName }}
        </span>
      </template>
      <template v-if="store.currentView === 'point'">
        <span class="separator">/</span>
        <span class="crumb active">{{ store.breadcrumbPointName }}</span>
      </template>
    </nav>

    <!-- Views -->
    <GlobalView v-if="store.currentView === 'global'" />
    <DomainDetail v-else-if="store.currentView === 'domain'" />
    <PointPage v-else-if="store.currentView === 'point'" />
  </div>
</template>

<script setup lang="ts">
import { createSkillLearningStore, SKILL_STORE_KEY } from '~/composables/skill-learning';
import GlobalView from '~/components/skill-learning/GlobalView.vue';
import DomainDetail from '~/components/skill-learning/DomainDetail.vue';
import PointPage from '~/components/skill-learning/PointPage.vue';

const props = defineProps<{
  skillId: string;
}>();

const useStore = createSkillLearningStore(props.skillId);
const store = useStore();

provide(SKILL_STORE_KEY, store);

const showDomainCrumb = computed(() =>
  store.currentView === 'domain' || store.currentView === 'point',
);

onMounted(() => {
  store.loadDomains();
});
</script>

<style scoped>
.skillTool {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  height: 100%;
}

/* Breadcrumb */
.breadcrumb {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: 14px;
  flex-shrink: 0;
}

.crumb {
  color: var(--color-text-secondary);
  font-weight: 500;
}

.crumb.clickable {
  cursor: pointer;
  transition: color var(--transition-fast);
}

.crumb.clickable:hover {
  color: var(--color-text-primary);
}

.crumb.active {
  color: var(--color-text-primary);
  font-weight: 600;
}

.separator {
  color: var(--color-text-disabled);
  font-size: 12px;
}

@media (max-width: 768px) {
  .breadcrumb {
    font-size: 13px;
    flex-wrap: wrap;
  }
}
</style>
