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

            <!-- Piano keyboard (config-driven) -->
            <div v-if="store.skillFeatures?.showPiano" class="panelSection">
              <h3 class="sectionLabel">钢琴键盘</h3>
              <PianoKeyboard
                :start-octave="2"
                :end-octave="6"
                :show-labels="true"
                :show-keyboard="true"
              />
            </div>

            <!-- Comprehension quizzes -->
            <div class="panelSection">
              <ComprehensionQuizzes :point-id="store.currentPoint.id" />
            </div>

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

            <!-- Linked songs -->
            <div class="panelSection">
              <LinkedSongs :point-id="store.currentPoint.id" />
            </div>

            <!-- Next point suggestion (shown after completion) -->
            <div v-if="isCompleted" class="panelSection">
              <NextPointCard
                :recommendation="nextRecommendation"
                :loading="store.recommendationsLoading"
                @navigate="store.navigateToPoint($event)"
              />
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

    <!-- Completion celebration overlay -->
    <CompletionCelebration
      :visible="store.showCelebration"
      :type="store.celebrationType"
      :message="store.celebrationMessage"
      :has-next="!!nextRecommendation"
      @dismiss="store.dismissCelebration()"
      @go-to-next="handleGoToNext"
    />
  </div>
</template>

<script setup lang="ts">
import { SKILL_STORE_KEY } from '~/composables/skill-learning';
import type { PointStatus } from '~/composables/skill-learning/types';
import StatusSelector from './StatusSelector.vue';
import TeachingContent from './TeachingContent.vue';
import ChatPanel from './ChatPanel.vue';
import ComprehensionQuizzes from './ComprehensionQuizzes.vue';
import PracticeTasks from './PracticeTasks.vue';
import NoteEditor from './NoteEditor.vue';
import LinkedArticles from './LinkedArticles.vue';
import LinkedSongs from './LinkedSongs.vue';
import PianoKeyboard from './PianoKeyboard.vue';
import CompletionCelebration from './CompletionCelebration.vue';
import NextPointCard from './NextPointCard.vue';

const props = defineProps<{
  productId?: number;
}>();

const store = inject(SKILL_STORE_KEY)!;

// Completion state
const isCompleted = computed(() =>
  store.currentPoint?.status === 'understood' || store.currentPoint?.status === 'practiced',
);

const nextRecommendation = computed(() =>
  store.recommendations[0] ?? null,
);

// Log view activity when point loads
watch(() => store.currentPoint, (point) => {
  if (point) {
    store.logActivity(point.id, 'view');
  }
});

// ===== Split pane resize (same pattern as ArticleReader) =====
const splitRatio = ref(65);
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

function handleGoToNext() {
  store.dismissCelebration();
  const next = store.recommendations[0];
  if (next) {
    store.navigateToPoint(next.pointId);
  }
}
</script>

<style scoped>
.pointPage {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  padding-bottom: var(--spacing-lg);
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
  padding-bottom: var(--spacing-xl);
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

.sectionLabel {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 var(--spacing-sm);
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
