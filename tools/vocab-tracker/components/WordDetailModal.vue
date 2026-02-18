<template>
  <BaseModal :open="open" :title="word?.word" max-width="520px" @close="$emit('close')">
    <template v-if="word">
      <!-- Header with speak button -->
      <div class="detailHeader">
        <div>
          <span class="wordText">{{ word.word }}</span>
          <span class="wordRank">#{{ word.rank }}</span>
        </div>
        <SpeakButton :text="word.word" size="md" />
      </div>

      <div v-if="isLoading" class="loadingState">加载中...</div>

      <template v-else>
        <!-- Definition -->
        <div v-if="definition" class="definitionSection">
          <!-- Model info -->
          <div class="modelInfo">
            <span>{{ definition.modelProvider }} / {{ definition.modelName }}</span>
            <button
              class="regenerateBtn"
              :disabled="isRegenerating"
              @click="handleRegenerate"
            >
              {{ isRegenerating ? '生成中...' : '重新生成' }}
            </button>
          </div>

          <p v-if="definition.partOfSpeech" class="partOfSpeech">{{ definition.partOfSpeech }}</p>
          <p class="definitionText">{{ definition.definition }}</p>

          <!-- Examples -->
          <div v-if="parsedExamples.length > 0" class="infoBlock">
            <p class="infoLabel">例句</p>
            <div v-for="(ex, idx) in parsedExamples" :key="idx" class="exampleItem">
              <div class="exampleLine">
                <span class="exampleSentence">{{ ex.sentence }}</span>
                <SpeakButton :text="ex.sentence" size="sm" />
              </div>
              <p v-if="ex.translation" class="exampleTranslation">{{ ex.translation }}</p>
            </div>
          </div>

          <div v-if="definition.synonyms" class="infoBlock">
            <p class="infoLabel">同义词</p>
            <p class="infoText">{{ definition.synonyms }}</p>
          </div>

          <div v-if="definition.antonyms" class="infoBlock">
            <p class="infoLabel">反义词</p>
            <p class="infoText">{{ definition.antonyms }}</p>
          </div>

          <div v-if="definition.wordFamily" class="infoBlock">
            <p class="infoLabel">词族</p>
            <p class="infoText">{{ definition.wordFamily }}</p>
          </div>

          <div v-if="definition.collocations" class="infoBlock">
            <p class="infoLabel">常用搭配</p>
            <p class="infoText">{{ definition.collocations }}</p>
          </div>
        </div>

        <div v-else class="emptyDef">暂无释义数据</div>
      </template>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import SpeakButton from './SpeakButton.vue';
import type { Definition } from '~/stores/study';

const props = defineProps<{
  open: boolean;
  word: { word: string; rank: number; wordId: number } | null;
}>();

defineEmits<{
  close: [];
}>();

const definition = ref<Definition | null>(null);
const isLoading = ref(false);
const isRegenerating = ref(false);

const parsedExamples = computed(() => {
  if (!definition.value) return [];
  const def = definition.value;
  if (Array.isArray(def.examples) && def.examples.length > 0) {
    return def.examples;
  }
  if (def.example) {
    return [{ sentence: def.example, translation: def.exampleTranslation || '' }];
  }
  return [];
});

watch(() => [props.open, props.word], async () => {
  if (!props.open || !props.word) return;
  isLoading.value = true;
  try {
    const result = await $fetch<Definition>(`/api/vocab/definitions/${props.word.wordId}`);
    definition.value = result;
  } catch {
    definition.value = null;
  } finally {
    isLoading.value = false;
  }
}, { immediate: true });

async function handleRegenerate() {
  if (!props.word) return;
  isRegenerating.value = true;
  try {
    const result = await $fetch<Definition>(
      `/api/vocab/definitions/${props.word.wordId}/regenerate`,
      { method: 'POST', body: {} },
    );
    definition.value = result;
  } catch {
    // silent
  } finally {
    isRegenerating.value = false;
  }
}
</script>

<style scoped>
.detailHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-md);
}

.wordText {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin-right: var(--spacing-sm);
}

.wordRank {
  font-size: 12px;
  color: var(--color-text-disabled);
  font-family: monospace;
}

.loadingState {
  text-align: center;
  padding: var(--spacing-lg) 0;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.modelInfo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-xs) var(--spacing-sm);
  background-color: var(--color-bg-hover);
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-md);
}

.regenerateBtn {
  background: none;
  border: none;
  font-size: 12px;
  color: var(--color-text-secondary);
  cursor: pointer;
  text-decoration: underline;
}

.regenerateBtn:hover:not(:disabled) {
  color: var(--color-text-primary);
}

.regenerateBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  text-decoration: none;
}

.partOfSpeech {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-xs);
}

.definitionText {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-md);
}

.definitionSection {
  display: flex;
  flex-direction: column;
}

.infoBlock {
  padding: var(--spacing-sm);
  background-color: var(--color-bg-hover);
  border-radius: var(--radius-sm);
  margin-bottom: var(--spacing-sm);
}

.infoLabel {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-xs);
}

.infoText {
  font-size: 13px;
  color: var(--color-text-primary);
}

.exampleItem {
  margin-bottom: var(--spacing-xs);
}

.exampleItem:last-child {
  margin-bottom: 0;
}

.exampleLine {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-xs);
}

.exampleSentence {
  flex: 1;
  font-size: 13px;
  font-style: italic;
  color: var(--color-text-primary);
}

.exampleTranslation {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 2px;
}

.emptyDef {
  text-align: center;
  padding: var(--spacing-lg) 0;
  font-size: 13px;
  color: var(--color-text-secondary);
}
</style>
