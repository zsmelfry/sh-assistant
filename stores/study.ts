import { defineStore } from 'pinia';
import type { ChatMessage } from '~/composables/useLlm';

// ===== Types =====

export interface DueReview {
  cardId: number;
  wordId: number;
  word: string;
  rank: number;
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewAt: number;
  lastReviewedAt: number | null;
}

export interface NewWord {
  wordId: number;
  word: string;
  rank: number;
}

export interface StudyCard {
  wordId: number;
  word: string;
  rank: number;
  cardId?: number;
  isNew: boolean;
  definition: Definition | null;
}

export interface Definition {
  id: number;
  wordId: number;
  definition: string;
  partOfSpeech: string;
  example: string;
  exampleTranslation: string;
  examples: Array<{ sentence: string; translation: string }>;
  synonyms: string;
  antonyms: string;
  wordFamily: string;
  collocations: string;
  modelProvider: string;
  modelName: string;
}

export interface StudyOverview {
  cards: { total: number; due: number; new: number; learning: number; mature: number };
  todaySession: { newWordsStudied: number; reviewsCompleted: number } | null;
  recentDays: Record<string, { reviews: number; avgQuality: number }>;
  recentSessions: Array<{ date: string; newWordsStudied: number; reviewsCompleted: number }>;
  vocabStatus: Record<string, number>;
}

export interface DailyPlan {
  dueReviews: DueReview[];
  newWords: NewWord[];
  stats: {
    dueReviewCount: number;
    newWordCount: number;
    newWordsStudiedToday: number;
    remainingNewWords: number;
    availableLearningCount: number;
  };
}

// ===== Store =====

export const useStudyStore = defineStore('study', () => {
  const vocabStore = useVocabStore();

  // State
  const cardQueue = ref<StudyCard[]>([]);
  const currentIndex = ref(0);
  const isFlipped = ref(false);
  const isLoading = ref(false);
  const isSessionComplete = ref(false);
  const error = ref<string | null>(null);
  const sessionNewWords = ref(0);
  const sessionReviews = ref(0);

  const overview = ref<StudyOverview | null>(null);

  // Computed
  const currentCard = computed<StudyCard | null>(() => {
    if (currentIndex.value >= cardQueue.value.length) return null;
    return cardQueue.value[currentIndex.value] ?? null;
  });

  const progress = computed(() => ({
    current: currentIndex.value,
    total: cardQueue.value.length,
    percentage: cardQueue.value.length > 0
      ? Math.round((currentIndex.value / cardQueue.value.length) * 100)
      : 0,
  }));

  const hasCards = computed(() => cardQueue.value.length > 0);

  // Load overview
  async function loadOverview(): Promise<void> {
    if (!vocabStore.currentUserId) return;
    overview.value = await $fetch<StudyOverview>('/api/vocab/srs/overview', {
      params: { userId: vocabStore.currentUserId },
    });
  }

  // Load definition for a card (with caching)
  async function loadDefinitionForCard(index: number): Promise<void> {
    const card = cardQueue.value[index];
    if (!card || card.definition) return;

    try {
      const def = await $fetch<Definition>(`/api/vocab/definitions/${card.wordId}`);
      cardQueue.value[index] = { ...card, definition: def };
    } catch (e) {
      console.error(`Failed to load definition for ${card.word}:`, e);
    }
  }

  // Preload next card's definition
  function preloadNextDefinition(index: number): void {
    const nextIndex = index + 1;
    const nextCard = cardQueue.value[nextIndex];
    if (nextCard && !nextCard.definition) {
      $fetch<Definition>(`/api/vocab/definitions/${nextCard.wordId}`)
        .then(def => {
          cardQueue.value[nextIndex] = { ...nextCard, definition: def };
        })
        .catch(() => {}); // silent preload failure
    }
  }

  // Watch currentIndex to load definitions
  watch(currentIndex, (newIndex) => {
    if (cardQueue.value.length === 0) return;
    loadDefinitionForCard(newIndex);
    preloadNextDefinition(newIndex);
  });

  // Start study session
  async function startSession(): Promise<void> {
    if (!vocabStore.currentUserId) return;

    isLoading.value = true;
    error.value = null;
    try {
      const plan = await $fetch<DailyPlan>('/api/vocab/srs/daily-plan', {
        params: { userId: vocabStore.currentUserId },
      });

      // Build card queue: reviews first, then new words
      const cards: StudyCard[] = [
        ...plan.dueReviews.map(r => ({
          wordId: r.wordId,
          word: r.word,
          rank: r.rank,
          cardId: r.cardId,
          isNew: false,
          definition: null,
        })),
        ...plan.newWords.map(w => ({
          wordId: w.wordId,
          word: w.word,
          rank: w.rank,
          isNew: true,
          definition: null,
        })),
      ];

      cardQueue.value = cards;
      currentIndex.value = 0;
      isFlipped.value = false;
      isSessionComplete.value = false;
      sessionNewWords.value = 0;
      sessionReviews.value = 0;

      // Load first card's definition + preload second
      if (cards.length > 0) {
        await loadDefinitionForCard(0);
        preloadNextDefinition(0);
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : '加载学习计划失败';
    } finally {
      isLoading.value = false;
    }
  }

  // Flip card
  function flipCard(): void {
    isFlipped.value = !isFlipped.value;
  }

  // Rate current card
  async function rateCard(quality: 0 | 1 | 2 | 3 | 4 | 5): Promise<void> {
    if (!vocabStore.currentUserId) return;

    const card = currentCard.value;
    if (!card) return;

    await $fetch('/api/vocab/srs/rate', {
      method: 'POST',
      body: {
        userId: vocabStore.currentUserId,
        wordId: card.wordId,
        cardId: card.cardId,
        quality,
        isNew: card.isNew,
      },
    });

    if (card.isNew) {
      sessionNewWords.value++;
    } else {
      sessionReviews.value++;
    }

    nextCard();
  }

  // Next card
  function nextCard(): void {
    isFlipped.value = false;
    if (currentIndex.value + 1 >= cardQueue.value.length) {
      isSessionComplete.value = true;
      completeSession();
    } else {
      currentIndex.value++;
    }
  }

  // Complete session
  async function completeSession(): Promise<void> {
    if (!vocabStore.currentUserId) return;
    try {
      await $fetch('/api/vocab/srs/session/complete', {
        method: 'POST',
        body: { userId: vocabStore.currentUserId },
      });
    } catch {
      // silent - session might not exist if no cards
    }
  }

  // Reset session
  function resetSession(): void {
    cardQueue.value = [];
    currentIndex.value = 0;
    isFlipped.value = false;
    isSessionComplete.value = false;
    sessionNewWords.value = 0;
    sessionReviews.value = 0;
    error.value = null;
  }

  return {
    cardQueue,
    currentIndex,
    isFlipped,
    isLoading,
    isSessionComplete,
    sessionNewWords,
    sessionReviews,
    overview,
    error,
    currentCard,
    progress,
    hasCards,
    loadOverview,
    startSession,
    flipCard,
    rateCard,
    nextCard,
    resetSession,
  };
});
