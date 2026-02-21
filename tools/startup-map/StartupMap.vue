<template>
  <div class="startupMap">
    <!-- Top bar: Breadcrumb + product button -->
    <div class="topBar">
      <nav class="breadcrumb">
        <span
          class="crumb"
          :class="{ clickable: currentView !== 'global' }"
          @click="handleGlobalClick()"
        >
          全局视图
        </span>
        <template v-if="showDomainCrumb">
          <span class="separator">/</span>
          <span
            class="crumb"
            :class="{ clickable: currentView === 'point' }"
            @click="currentView === 'point' && skillStore.navigateToDomain(skillStore.currentDomainId!)"
          >
            {{ skillStore.breadcrumbDomainName }}
          </span>
        </template>
        <template v-if="currentView === 'point'">
          <span class="separator">/</span>
          <span class="crumb active">{{ skillStore.breadcrumbPointName }}</span>
        </template>
        <template v-if="currentView === 'product'">
          <span class="separator">/</span>
          <span class="crumb active">产品档案</span>
        </template>
      </nav>

      <div class="topBarRight">
        <ProductSwitcher />
        <button
          class="productBtn"
          :class="{ active: currentView === 'product' }"
          title="产品档案"
          @click="navigateToProduct()"
        >
          <Briefcase :size="18" />
        </button>
      </div>
    </div>

    <!-- Views -->
    <GlobalView v-if="currentView === 'global'" />
    <DomainDetail v-else-if="currentView === 'domain'" />
    <PointPage v-else-if="currentView === 'point'" :product-id="productStore.activeProduct?.id" />
    <ProductProfile v-else-if="currentView === 'product'" />
  </div>
</template>

<script setup lang="ts">
import { Briefcase } from 'lucide-vue-next';
import { SKILL_STORE_KEY } from '~/composables/skill-learning';
import { useStartupMapSkillStore, useStartupMapProductStore } from '~/stores/startup-map';
import type { StartupMapView } from './types';
import GlobalView from '~/components/skill-learning/GlobalView.vue';
import DomainDetail from '~/components/skill-learning/DomainDetail.vue';
import PointPage from '~/components/skill-learning/PointPage.vue';
import ProductProfile from './components/ProductProfile.vue';
import ProductSwitcher from './components/ProductSwitcher.vue';

const skillStore = useStartupMapSkillStore();
const productStore = useStartupMapProductStore();

// Provide skill store for shared components via inject
provide(SKILL_STORE_KEY, skillStore);

// View management — extends skill store's view with 'product'
const currentView = ref<StartupMapView>(skillStore.currentView);

// Sync from skill store view changes
watch(() => skillStore.currentView, (v) => {
  currentView.value = v;
});

// Navigate to product view (local-only, not a skill store view)
function navigateToProduct() {
  currentView.value = 'product';
}

// Override breadcrumb click to handle product→global navigation
function handleGlobalClick() {
  if (currentView.value === 'product') {
    // When on product view, skillStore.currentView is already 'global',
    // so navigateToGlobal() won't trigger the watcher. Set directly.
    currentView.value = 'global';
    skillStore.loadDomains();
  } else if (currentView.value !== 'global') {
    skillStore.navigateToGlobal();
  }
}

const showDomainCrumb = computed(() =>
  currentView.value === 'domain' || currentView.value === 'point',
);

onMounted(() => {
  skillStore.loadDomains();
  productStore.loadActiveProduct();
});
</script>

<style scoped>
.startupMap {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  max-width: 1200px;
  margin: 0 auto;
  height: 100%;
}

/* Top bar */
.topBar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

/* Breadcrumb */
.breadcrumb {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: 14px;
  min-height: 32px;
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

.topBarRight {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

/* Product button */
.productBtn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.productBtn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.productBtn.active {
  background: var(--color-accent);
  color: var(--color-accent-inverse);
  border-color: var(--color-accent);
}

@media (max-width: 768px) {
  .breadcrumb {
    font-size: 13px;
    flex-wrap: wrap;
  }
  .productBtn {
    min-width: var(--touch-target-min);
    min-height: var(--touch-target-min);
  }
}
</style>
