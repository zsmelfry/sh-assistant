<template>
  <div class="quizCard" :class="{ passed: quiz.passed }">
    <div class="quizHeader">
      <span class="quizNum">{{ index }}.</span>
      <span class="quizBadge">{{ quizTypeLabel }}</span>
      <span v-if="quiz.passed" class="passedBadge">已通过</span>
    </div>

    <p class="quizQuestion">{{ quiz.question }}</p>

    <!-- Audio choice -->
    <div v-if="quiz.type === 'audio_choice'" class="audioChoiceSection">
      <PianoKeyboard
        :audio-spec="quiz.audioSpec"
        :show-keyboard="false"
      />
      <div v-if="quiz.options" class="optionsList">
        <button
          v-for="(option, i) in quiz.options"
          :key="i"
          class="optionBtn"
          :class="{
            selected: selectedAnswer === option,
            correct: showResult && option === quiz.correctAnswer,
            wrong: showResult && selectedAnswer === option && !lastResult?.isCorrect,
          }"
          :disabled="quiz.passed || submitting"
          @click="selectedAnswer = option"
        >
          <span class="optionLabel">{{ String.fromCharCode(65 + i) }}</span>
          <span class="optionText">{{ option }}</span>
        </button>
      </div>
    </div>

    <!-- Multiple choice -->
    <div v-else-if="quiz.type === 'multiple_choice' && quiz.options" class="optionsList">
      <button
        v-for="(option, i) in quiz.options"
        :key="i"
        class="optionBtn"
        :class="{
          selected: selectedAnswer === option,
          correct: showResult && option === quiz.correctAnswer,
          wrong: showResult && selectedAnswer === option && !lastResult?.isCorrect,
        }"
        :disabled="quiz.passed || submitting"
        @click="selectedAnswer = option"
      >
        <span class="optionLabel">{{ String.fromCharCode(65 + i) }}</span>
        <span class="optionText">{{ option }}</span>
      </button>
    </div>

    <!-- True/False -->
    <div v-else-if="quiz.type === 'true_false'" class="tfButtons">
      <button
        v-for="opt in ['正确', '错误']"
        :key="opt"
        class="tfBtn"
        :class="{
          selected: selectedAnswer === opt,
          correct: showResult && opt === quiz.correctAnswer,
          wrong: showResult && selectedAnswer === opt && !lastResult?.isCorrect,
        }"
        :disabled="quiz.passed || submitting"
        @click="selectedAnswer = opt"
      >
        {{ opt }}
      </button>
    </div>

    <!-- Fill blank -->
    <div v-else-if="quiz.type === 'fill_blank'" class="fillBlank">
      <input
        v-model="fillAnswer"
        class="fillInput"
        placeholder="输入你的答案..."
        :disabled="quiz.passed || submitting"
        @keydown.enter.prevent="handleSubmit"
      />
    </div>

    <!-- Submit button (not passed yet) -->
    <button
      v-if="!quiz.passed && !showResult"
      class="submitBtn"
      :disabled="!canSubmit || submitting"
      @click="handleSubmit"
    >
      {{ submitting ? '提交中...' : '提交答案' }}
    </button>

    <!-- Result feedback -->
    <div v-if="showResult && lastResult" class="resultFeedback" :class="{ correct: lastResult.isCorrect }">
      <span class="resultIcon">{{ lastResult.isCorrect ? '✓' : '✗' }}</span>
      <span class="resultText">{{ lastResult.isCorrect ? '回答正确！' : '回答错误，再想想' }}</span>
    </div>

    <!-- Explanation (shown after correct or after incorrect) -->
    <div v-if="(showResult && lastResult?.explanation) || (quiz.passed && quiz.explanation)" class="explanation">
      <p class="explanationText">{{ lastResult?.explanation || quiz.explanation }}</p>
    </div>

    <!-- Retry button after wrong answer -->
    <button
      v-if="showResult && lastResult && !lastResult.isCorrect"
      class="retryBtn"
      @click="resetAnswer"
    >
      重新作答
    </button>
  </div>
</template>

<script setup lang="ts">
import type { SmQuizWithAttempt } from '~/composables/skill-learning/types';
import PianoKeyboard from './PianoKeyboard.vue';

const props = defineProps<{
  quiz: SmQuizWithAttempt;
  index?: number;
}>();

const emit = defineEmits<{
  answer: [quizId: number, answer: string];
  answered: [result: { isCorrect: boolean; explanation: string | null }];
}>();

const selectedAnswer = ref('');
const fillAnswer = ref('');
const submitting = ref(false);
const showResult = ref(false);
const lastResult = ref<{ isCorrect: boolean; explanation: string | null } | null>(null);

const quizTypeLabel = computed(() => {
  switch (props.quiz.type) {
    case 'multiple_choice': return '选择题';
    case 'true_false': return '判断题';
    case 'fill_blank': return '填空题';
    case 'audio_choice': return '听音选择';
    default: return '测验';
  }
});

const canSubmit = computed(() => {
  if (props.quiz.type === 'fill_blank') return fillAnswer.value.trim().length > 0;
  return selectedAnswer.value.length > 0;
});

async function handleSubmit() {
  if (!canSubmit.value || submitting.value) return;

  const answer = props.quiz.type === 'fill_blank' ? fillAnswer.value.trim() : selectedAnswer.value;
  submitting.value = true;
  showResult.value = false;

  emit('answer', props.quiz.id, answer);

  // Wait for parent to handle the answer and call back
  // The parent will update quiz.passed if correct
}

// Allow parent to report result back
function reportResult(result: { isCorrect: boolean; explanation: string | null }) {
  lastResult.value = result;
  showResult.value = true;
  submitting.value = false;
}

function resetAnswer() {
  selectedAnswer.value = '';
  fillAnswer.value = '';
  showResult.value = false;
  lastResult.value = null;
}

defineExpose({ reportResult });
</script>

<style scoped>
.quizCard {
  padding: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-sidebar);
  margin-top: var(--spacing-sm);
  transition: all var(--transition-fast);
}

.quizCard.passed {
  opacity: 0.7;
}

.quizHeader {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
}

.quizNum {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.quizBadge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px var(--spacing-xs);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
}

.passedBadge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px var(--spacing-xs);
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: var(--color-accent-inverse);
}

.quizQuestion {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
  line-height: 1.5;
  margin-bottom: var(--spacing-sm);
}

/* Audio choice */
.audioChoiceSection {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

/* Multiple choice options */
.optionsList {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.optionBtn {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  cursor: pointer;
  text-align: left;
  transition: all var(--transition-fast);
}

.optionBtn:hover:not(:disabled) {
  background: var(--color-bg-hover);
}

.optionBtn.selected {
  border-color: var(--color-accent);
  background: var(--color-bg-hover);
}

.optionBtn.correct {
  border-color: var(--color-accent);
  background: var(--color-accent);
  color: var(--color-accent-inverse);
}

.optionBtn.correct .optionLabel,
.optionBtn.correct .optionText {
  color: var(--color-accent-inverse);
}

.optionBtn.wrong {
  border-color: var(--color-danger);
  opacity: 0.8;
}

.optionBtn:disabled {
  cursor: default;
  opacity: 0.6;
}

.optionBtn.correct:disabled {
  opacity: 1;
}

.optionLabel {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
  flex-shrink: 0;
  width: 20px;
}

.optionText {
  font-size: 13px;
  color: var(--color-text-primary);
}

/* True/false */
.tfButtons {
  display: flex;
  gap: var(--spacing-sm);
}

.tfBtn {
  flex: 1;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.tfBtn:hover:not(:disabled) {
  background: var(--color-bg-hover);
}

.tfBtn.selected {
  border-color: var(--color-accent);
  background: var(--color-bg-hover);
}

.tfBtn.correct {
  border-color: var(--color-accent);
  background: var(--color-accent);
  color: var(--color-accent-inverse);
}

.tfBtn.wrong {
  border-color: var(--color-danger);
  opacity: 0.8;
}

.tfBtn:disabled {
  cursor: default;
  opacity: 0.6;
}

.tfBtn.correct:disabled {
  opacity: 1;
}

/* Fill blank */
.fillBlank {
  margin-bottom: var(--spacing-sm);
}

.fillInput {
  width: 100%;
  padding: var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  outline: none;
  transition: border-color var(--transition-fast);
}

.fillInput:focus {
  border-color: var(--color-accent);
}

.fillInput:disabled {
  opacity: 0.6;
}

/* Submit */
.submitBtn {
  margin-top: var(--spacing-sm);
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

.submitBtn:hover:not(:disabled) {
  opacity: 0.85;
}

.submitBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Result */
.resultFeedback {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  margin-top: var(--spacing-sm);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  background: var(--color-bg-hover);
  color: var(--color-text-secondary);
}

.resultFeedback.correct {
  background: var(--color-accent);
  color: var(--color-accent-inverse);
}

.resultIcon {
  font-size: 16px;
  font-weight: 700;
}

.explanation {
  margin-top: var(--spacing-xs);
  padding: var(--spacing-sm);
  background: var(--color-bg-primary);
  border-radius: var(--radius-sm);
  border-left: 3px solid var(--color-border);
}

.explanationText {
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

/* Retry */
.retryBtn {
  margin-top: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.retryBtn:hover {
  background: var(--color-bg-hover);
}
</style>
