<template>
  <div class="startupMap">
    <!-- Top bar: Breadcrumb + product button -->
    <div class="topBar">
      <nav class="breadcrumb">
        <span
          class="crumb"
          :class="{ clickable: currentView !== 'global' }"
          @click="currentView !== 'global' && store.navigateToGlobal()"
        >
          全局视图
        </span>
        <template v-if="showDomainCrumb">
          <span class="separator">/</span>
          <span
            class="crumb"
            :class="{ clickable: currentView === 'point' }"
            @click="currentView === 'point' && store.navigateToDomain(store.currentDomainId!)"
          >
            {{ store.breadcrumbDomainName }}
          </span>
        </template>
        <template v-if="currentView === 'point'">
          <span class="separator">/</span>
          <span class="crumb active">{{ store.breadcrumbPointName }}</span>
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
          @click="store.navigateToProduct()"
        >
          <Briefcase :size="18" />
        </button>
      </div>
    </div>

    <!-- Views -->
    <GlobalView v-if="currentView === 'global'" />
    <DomainDetail v-else-if="currentView === 'domain'" />
    <PointPage v-else-if="currentView === 'point'" />
    <ProductProfile v-else-if="currentView === 'product'" />
  </div>
</template>

<script setup lang="ts">
import { Briefcase } from 'lucide-vue-next';
import GlobalView from './components/GlobalView.vue';
import DomainDetail from './components/DomainDetail.vue';
import PointPage from './components/PointPage.vue';
import ProductProfile from './components/ProductProfile.vue';
import ProductSwitcher from './components/ProductSwitcher.vue';

const store = useStartupMapStore();

const currentView = computed(() => store.currentView);

const showDomainCrumb = computed(() =>
  currentView.value === 'domain' || currentView.value === 'point',
);

onMounted(() => {
  store.loadDomains();
  store.loadActiveProduct();
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
