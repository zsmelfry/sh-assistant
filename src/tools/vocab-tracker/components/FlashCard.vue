<template>
  <div class="flashCardContainer">
    <!-- Card tag -->
    <div class="cardMeta">
      <span class="cardTag" :class="card.isNew ? 'tagNew' : 'tagReview'">
        {{ card.isNew ? '新词' : '复习' }}
      </span>
      <span class="cardRank">#{{ card.rank }}</span>
    </div>

    <!-- Flip card -->
    <div
      class="cardWrapper"
      :class="{ flipped: isFlipped, hasContent: isFlipped }"
      @click="handleFlip()"
    >
      <div class="cardInner" :class="{ rotated: isFlipped }">
        <!-- Front: French word -->
        <div class="cardFace cardFront">
          <div class="frontContent">
            <div class="wordRow">
              <span class="wordLarge">{{ card.word }}</span>
              <SpeakButton :text="card.word" size="md" :lang="vocabStore.activeLanguageTts" />
            </div>
            <p class="flipHint">点击翻转查看释义</p>
          </div>
        </div>

        <!-- Back: Definition -->
        <div class="cardFace cardBack" :class="{ visible: isFlipped }">
          <div class="backContent">
            <div class="wordRow">
              <span class="wordMedium">{{ card.word }}</span>
              <SpeakButton :text="card.word" size="md" :lang="vocabStore.activeLanguageTts" />
            </div>

            <template v-if="!card.definition">
              <div class="loadingDef">
                <div class="spinner"></div>
                <p>释义加载中...</p>
              </div>
            </template>
            <template v-else>
              <p v-if="card.definition.partOfSpeech" class="pos">{{ card.definition.partOfSpeech }}</p>
              <p class="defText">{{ card.definition.definition }}</p>

              <div class="divider" v-if="parsedExamples.length || card.definition.synonyms"></div>

              <!-- Examples -->
              <div v-if="parsedExamples.length" class="infoBlock">
                <p class="infoLabel">例句</p>
                <div v-for="(ex, idx) in parsedExamples" :key="idx" class="exItem">
                  <div class="exLine">
                    <span class="exSentence">{{ ex.sentence }}</span>
                    <SpeakButton :text="ex.sentence" size="sm" :lang="vocabStore.activeLanguageTts" />
                  </div>
                  <p v-if="ex.translation" class="exTrans">{{ ex.translation }}</p>
                </div>
              </div>

              <div v-if="card.definition.synonyms" class="infoBlock">
                <p class="infoLabel">同义词</p>
                <p class="infoVal">{{ card.definition.synonyms }}</p>
              </div>

              <div v-if="card.definition.antonyms" class="infoBlock">
                <p class="infoLabel">反义词</p>
                <p class="infoVal">{{ card.definition.antonyms }}</p>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- Rating buttons (shown when flipped) -->
    <div v-if="isFlipped" class="ratingSection">
      <div class="ratingHeader">
        <span class="ratingPrompt">你记住了吗？</span>
        <button class="chatBtn" @click="$emit('openChat')">
          问问题
        </button>
      </div>
      <div class="ratingGrid">
        <button class="rateBtn rateFail" @click="handleRate(0)">
          <span class="rateLabel">忘了</span>
        </button>
        <button class="rateBtn rateHard" @click="handleRate(2)">
          <span class="rateLabel">模糊</span>
        </button>
        <button class="rateBtn rateGood" @click="handleRate(4)">
          <span class="rateLabel">记得</span>
        </button>
        <button class="rateBtn rateEasy" @click="handleRate(5)">
          <span class="rateLabel">简单</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import SpeakButton from './SpeakButton.vue';
import { useStudyStore } from '~/stores/study';
import type { StudyCard } from '~/stores/study';

const vocabStore = useVocabStore();

const props = defineProps<{
  card: StudyCard;
  isFlipped: boolean;
}>();

const emit = defineEmits<{
  openChat: [];
}>();

const studyStore = useStudyStore();

const parsedExamples = computed(() => {
  const def = props.card.definition;
  if (!def) return [];
  if (Array.isArray(def.examples) && def.examples.length > 0) {
    return def.examples;
  }
  if (def.example) {
    return [{ sentence: def.example, translation: def.exampleTranslation || '' }];
  }
  return [];
});

function handleFlip() {
  studyStore.flipCard();
}

async function handleRate(quality: 0 | 2 | 4 | 5) {
  await studyStore.rateCard(quality);
}
</script>

<style scoped>
.flashCardContainer {
  width: 100%;
}

.cardMeta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-sm);
}

.cardTag {
  font-size: 12px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 10px;
}

.tagNew {
  border: 1px solid var(--color-accent);
  color: var(--color-accent);
}

.tagReview {
  border: 1px solid var(--color-text-secondary);
  color: var(--color-text-secondary);
}

.cardRank {
  font-size: 12px;
  color: var(--color-text-disabled);
  font-family: monospace;
}

/* Card flip — grid stacking technique */
.cardWrapper {
  perspective: 1000px;
  cursor: pointer;
}

.cardWrapper.flipped {
  cursor: pointer;
}

.cardInner {
  display: grid;
  transition: transform 500ms;
  transform-style: preserve-3d;
}

.cardInner.rotated {
  transform: rotateY(180deg);
}

.cardFace {
  grid-area: 1 / 1;
  backface-visibility: hidden;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  background-color: var(--color-bg-primary);
}

.cardFront {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
}

.cardBack {
  transform: rotateY(180deg);
  overflow-y: auto;
  pointer-events: none;
}

.cardBack.visible {
  pointer-events: auto;
  min-height: 200px;
}

.frontContent {
  text-align: center;
  padding: var(--spacing-lg);
}

.backContent {
  padding: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.wordRow {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
}

.wordLarge {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.wordMedium {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.flipHint {
  font-size: 13px;
  color: var(--color-text-disabled);
  margin-top: var(--spacing-md);
}

.loadingDef {
  text-align: center;
  padding: var(--spacing-md) 0;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto var(--spacing-sm);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.pos {
  font-size: 12px;
  color: var(--color-text-secondary);
  text-align: center;
}

.defText {
  font-size: 15px;
  color: var(--color-text-secondary);
  text-align: center;
}

.divider {
  height: 1px;
  background-color: var(--color-border);
  margin: var(--spacing-xs) 0;
}

.infoBlock {
  background-color: var(--color-bg-hover);
  border-radius: var(--radius-sm);
  padding: var(--spacing-sm);
}

.infoLabel {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-xs);
}

.infoVal {
  font-size: 13px;
  color: var(--color-text-primary);
}

.exItem + .exItem {
  margin-top: var(--spacing-xs);
  padding-top: var(--spacing-xs);
  border-top: 1px solid var(--color-border);
}

.exLine {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-xs);
}

.exSentence {
  flex: 1;
  font-size: 13px;
  font-style: italic;
  color: var(--color-text-primary);
}

.exTrans {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 2px;
}

/* Rating */
.ratingSection {
  margin-top: var(--spacing-lg);
}

.ratingHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-sm);
}

.ratingPrompt {
  font-size: 14px;
  color: var(--color-text-secondary);
}

.chatBtn {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  font-size: 12px;
  cursor: pointer;
  color: var(--color-text-secondary);
}

.chatBtn:hover {
  background-color: var(--color-bg-hover);
}

.ratingGrid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--spacing-sm);
}

.rateBtn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-sm);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background-color: var(--color-bg-primary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.rateBtn:hover {
  background-color: var(--color-bg-hover);
}

.rateBtn:active {
  transform: scale(0.96);
}

.rateFail { border-color: var(--color-danger); color: var(--color-danger); }
.rateFail:hover { background-color: var(--color-danger-bg); }

.rateHard { color: var(--color-text-secondary); }

.rateGood { border-color: var(--color-accent); color: var(--color-accent); }

.rateEasy { color: var(--color-text-secondary); }

.rateLabel {
  font-size: 13px;
}

@media (max-width: 768px) {
  .rateBtn {
    min-height: var(--touch-target-min);
  }
  .chatBtn {
    min-height: var(--touch-target-min);
  }
  .chatBtn:active {
    background-color: var(--color-bg-hover);
  }
}
</style>
