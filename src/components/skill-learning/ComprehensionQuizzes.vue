<template>
  <div class="comprehensionQuizzes">
    <button class="collapseHeader" @click="collapsed = !collapsed">
      <ChevronRight :size="16" class="chevron" :class="{ expanded: !collapsed }" />
      <h3 class="sectionTitle">理解测验</h3>
      <span v-if="store.quizzes.length > 0" class="badge">{{ passedCount }}/{{ store.quizzes.length }}</span>
    </button>

    <template v-if="!collapsed">
      <!-- Loading -->
      <div v-if="store.quizzesLoading" class="loadingState">加载中...</div>

      <!-- Generating -->
      <div v-else-if="store.quizzesGenerating" class="loadingState">正在生成理解测验...</div>

      <!-- Quiz list -->
      <template v-else-if="store.quizzes.length > 0">
        <div class="quizProgress">
          <span class="progressText">{{ passedCount }} / {{ store.quizzes.length }} 已通过</span>
          <div class="progressBar">
            <div class="progressFill" :style="{ width: progressPercent + '%' }" />
          </div>
        </div>

        <div class="quizList">
          <ComprehensionQuiz
            v-for="(quiz, idx) in store.quizzes"
            :key="quiz.id"
            :ref="(el: any) => setQuizRef(quiz.id, el)"
            :quiz="quiz"
            :index="idx + 1"
            @answer="handleAnswer"
          />
        </div>
      </template>

      <!-- No quizzes — offer generate button -->
      <div v-else class="emptyQuizzes">
        <p class="emptyHint">该知识点暂无理解测验</p>
        <button class="generateBtn" @click="handleGenerate">
          生成测验
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ChevronRight } from 'lucide-vue-next';
import { SKILL_STORE_KEY } from '~/composables/skill-learning';
import ComprehensionQuiz from './ComprehensionQuiz.vue';

const props = defineProps<{
  pointId: number;
}>();

const store = inject(SKILL_STORE_KEY)!;
const collapsed = ref(false);

const quizRefs = ref<Record<number, any>>({});

function setQuizRef(quizId: number, el: any) {
  if (el) quizRefs.value[quizId] = el;
}

const passedCount = computed(() =>
  store.quizzes.filter(q => q.passed).length,
);

const progressPercent = computed(() =>
  store.quizzes.length > 0
    ? Math.round((passedCount.value / store.quizzes.length) * 100)
    : 0,
);

async function handleAnswer(quizId: number, answer: string) {
  const result = await store.submitQuizAnswer(props.pointId, quizId, answer);
  const ref = quizRefs.value[quizId];
  if (ref?.reportResult) {
    ref.reportResult(result);
  }
}

function handleGenerate() {
  store.generateQuizzes(props.pointId);
}
</script>

<style scoped>
.comprehensionQuizzes {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.collapseHeader {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;
}

.chevron {
  transition: transform var(--transition-fast);
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.chevron.expanded {
  transform: rotate(90deg);
}

.sectionTitle {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.badge {
  font-size: 11px;
  color: var(--color-text-secondary);
  padding: 1px 6px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.loadingState {
  text-align: center;
  padding: var(--spacing-md);
  font-size: 13px;
  color: var(--color-text-secondary);
}

/* Progress */
.quizProgress {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.progressText {
  font-size: 12px;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.progressBar {
  flex: 1;
  height: 4px;
  background: var(--color-bg-hover);
  border-radius: 2px;
  overflow: hidden;
}

.progressFill {
  height: 100%;
  background: var(--color-accent);
  border-radius: 2px;
  transition: width 0.3s ease;
}

/* Quiz list */
.quizList {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

/* Empty state */
.emptyQuizzes {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
}

.emptyHint {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.generateBtn {
  padding: var(--spacing-xs) var(--spacing-md);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: var(--color-accent-inverse);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}

.generateBtn:hover {
  opacity: 0.85;
}
</style>
