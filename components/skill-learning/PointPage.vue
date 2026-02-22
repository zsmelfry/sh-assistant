<template>
  <div class="pointPage">
    <!-- Loading -->
    <div v-if="store.pointLoading" class="loadingState">
      加载中...
    </div>

    <template v-else-if="store.currentPoint">
      <!-- Point header: title + status -->
      <div class="pointHeader">
        <div class="pointInfo">
          <h2 class="pointTitle">{{ store.currentPoint.name }}</h2>
          <p v-if="store.currentPoint.description" class="pointDesc">
            {{ store.currentPoint.description }}
          </p>
        </div>
        <StatusSelector
          :status="store.currentPoint.status"
          @update:status="handleStatusChange"
        />
      </div>

      <!-- Split view: teaching (left) + chat (right) -->
      <div class="splitView">
        <!-- Left panel — teaching content -->
        <div class="leftPanel" :style="leftPanelStyle">
          <div class="panelScroll">
            <TeachingContent
              :teaching="store.teaching"
              :generating="store.generating"
              :streaming-sections="store.streamingSections"
              @generate="handleGenerate"
              @regenerate="handleRegenerate"
            />

            <!-- Practice tasks -->
            <div class="panelSection">
              <PracticeTasks :point-id="store.currentPoint.id" />
            </div>

            <!-- Notes -->
            <div class="panelSection">
              <NoteEditor :point-id="store.currentPoint.id" :product-id="props.productId" />
            </div>

            <!-- Linked articles -->
            <div class="panelSection">
              <LinkedArticles :point-id="store.currentPoint.id" />
            </div>
          </div>
        </div>

        <!-- Resize divider -->
        <div
          class="resizeDivider"
          :class="{ dragging: isDragging }"
          @mousedown="startResize"
          @dblclick="splitRatio = 50"
          @touchstart.prevent="startTouchResize"
        >
          <div class="dividerHandle" />
        </div>

        <!-- Right panel — chat -->
        <div class="rightPanel" :style="rightPanelStyle">
          <ChatPanel :point-id="store.currentPoint.id" />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { SKILL_STORE_KEY } from '~/composables/skill-learning';
import type { PointStatus } from '~/composables/skill-learning/types';
import StatusSelector from './StatusSelector.vue';
import TeachingContent from './TeachingContent.vue';
import ChatPanel from './ChatPanel.vue';
import PracticeTasks from './PracticeTasks.vue';
import NoteEditor from './NoteEditor.vue';
import LinkedArticles from './LinkedArticles.vue';

const props = defineProps<{
  productId?: number;
}>();

const store = inject(SKILL_STORE_KEY)!;

// Log view activity when point loads
watch(() => store.currentPoint, (point) => {
  if (point) {
    store.logActivity(point.id, 'view');
  }
});

// ===== Split pane resize (same pattern as ArticleReader) =====
const splitRatio = ref(55);
const isDragging = ref(false);

const leftPanelStyle = computed(() => ({
  flex: `0 0 calc(${splitRatio.value}% - 6px)`,
}));

const rightPanelStyle = computed(() => ({
  flex: `0 0 calc(${100 - splitRatio.value}% - 6px)`,
}));

function startResize(e: MouseEvent) {
  e.preventDefault();
  isDragging.value = true;
  const startX = e.clientX;
  const startRatio = splitRatio.value;

  const splitViewEl = (e.target as HTMLElement).parentElement;
  if (!splitViewEl) return;
  const totalWidth = splitViewEl.offsetWidth;

  function onMouseMove(ev: MouseEvent) {
    const dx = ev.clientX - startX;
    const newRatio = startRatio + (dx / totalWidth) * 100;
    splitRatio.value = Math.max(25, Math.min(75, newRatio));
  }

  function onMouseUp() {
    isDragging.value = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

function startTouchResize(e: TouchEvent) {
  isDragging.value = true;
  const startX = e.touches[0].clientX;
  const startRatio = splitRatio.value;

  const splitViewEl = (e.target as HTMLElement).parentElement;
  if (!splitViewEl) return;
  const totalWidth = splitViewEl.offsetWidth;

  function onTouchMove(ev: TouchEvent) {
    const dx = ev.touches[0].clientX - startX;
    const newRatio = startRatio + (dx / totalWidth) * 100;
    splitRatio.value = Math.max(25, Math.min(75, newRatio));
  }

  function onTouchEnd() {
    isDragging.value = false;
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', onTouchEnd);
  }

  document.addEventListener('touchmove', onTouchMove);
  document.addEventListener('touchend', onTouchEnd);
}

// ===== Handlers =====
function handleStatusChange(status: PointStatus) {
  if (store.currentPointId) {
    store.updatePointStatus(store.currentPointId, status);
  }
}

function handleGenerate() {
  if (store.currentPointId) {
    store.generateTeaching(store.currentPointId, false);
  }
}

function handleRegenerate() {
  if (store.currentPointId) {
    store.generateTeaching(store.currentPointId, true);
  }
}
</script>

<style scoped>
.pointPage {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
}

.loadingState {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-xl);
  color: var(--color-text-secondary);
  font-size: 14px;
}

/* Header */
.pointHeader {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--spacing-md);
  flex-shrink: 0;
}

.pointTitle {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.pointDesc {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-top: var(--spacing-xs);
  line-height: 1.4;
}

/* Split layout */
.splitView {
  display: flex;
  flex: 1;
  min-height: 0;
}

.leftPanel,
.rightPanel {
  min-width: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 12px var(--spacing-md);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.panelScroll {
  flex: 1;
  overflow-y: auto;
}

/* Resize divider */
.resizeDivider {
  flex-shrink: 0;
  width: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: col-resize;
  user-select: none;
}

.resizeDivider:hover .dividerHandle,
.resizeDivider.dragging .dividerHandle {
  background-color: var(--color-accent);
}

.dividerHandle {
  width: 3px;
  height: 32px;
  border-radius: 2px;
  background-color: var(--color-border);
  transition: background-color var(--transition-fast);
}

.panelSection {
  margin-top: var(--spacing-md);
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--color-border);
}

@media (max-width: 768px) {
  .pointHeader {
    flex-direction: column;
  }
  .splitView {
    flex-direction: column;
    min-height: auto;
    gap: var(--spacing-md);
  }
  .leftPanel,
  .rightPanel {
    flex: 1 1 auto !important;
    min-height: 300px;
  }
  .resizeDivider {
    display: none;
  }
}
</style>
