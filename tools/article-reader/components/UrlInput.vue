<template>
  <div class="urlInputWrapper">
    <form class="urlBar" @submit.prevent="handleFetch">
      <input
        ref="inputRef"
        v-model="urlInput"
        class="urlInput"
        type="url"
        placeholder="粘贴文章 URL ..."
        :disabled="store.fetchLoading"
      />
      <button
        class="fetchBtn"
        type="submit"
        :disabled="!urlInput.trim() || store.fetchLoading"
      >
        {{ store.fetchLoading ? '加载中...' : '加载' }}
      </button>
      <button
        v-if="store.currentArticle"
        class="bookmarkBtn"
        type="button"
        :class="{ bookmarked: store.isBookmarked }"
        :disabled="store.bookmarkLoading"
        :title="store.isBookmarked ? '取消收藏' : '收藏'"
        @click="store.toggleBookmark()"
      >
        <component :is="store.isBookmarked ? StarOff : Star" :size="16" :stroke-width="1.5" />
        <span class="bookmarkLabel">{{ store.isBookmarked ? '取消收藏' : '收藏' }}</span>
      </button>
    </form>

    <div v-if="store.fetchError" class="errorBanner">
      {{ store.fetchError }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { Star, StarOff } from 'lucide-vue-next';

const store = useArticleReaderStore();
const urlInput = ref('');
const inputRef = ref<HTMLInputElement | null>(null);

async function handleFetch() {
  const url = urlInput.value.trim();
  if (!url) return;

  try {
    await store.fetchArticle(url);
  } catch {
    // Error is stored in store.fetchError
  }
}

onMounted(() => {
  inputRef.value?.focus();
});
</script>

<style scoped>
.urlInputWrapper {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.urlBar {
  display: flex;
  gap: var(--spacing-sm);
}

.urlInput {
  flex: 1;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  outline: none;
  transition: border-color var(--transition-fast);
}

.urlInput:focus {
  border-color: var(--color-accent);
}

.urlInput::placeholder {
  color: var(--color-text-disabled);
}

.fetchBtn {
  padding: var(--spacing-sm) var(--spacing-lg);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-sm);
  background-color: var(--color-accent);
  color: var(--color-accent-inverse);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: opacity var(--transition-fast);
}

.fetchBtn:hover:not(:disabled) {
  opacity: 0.85;
}

.fetchBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.bookmarkBtn {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  font-size: 13px;
  cursor: pointer;
  color: var(--color-text-secondary);
  white-space: nowrap;
  transition: all var(--transition-fast);
}

.bookmarkBtn:hover {
  background-color: var(--color-bg-hover);
}

.bookmarkBtn.bookmarked {
  background-color: var(--color-accent);
  color: var(--color-accent-inverse);
  border-color: var(--color-accent);
}

.bookmarkBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.errorBanner {
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-sm);
  background-color: var(--color-danger-bg);
  color: var(--color-danger);
  font-size: 13px;
}

@media (max-width: 768px) {
  .urlBar {
    flex-wrap: wrap;
  }
  .urlInput {
    min-height: var(--touch-target-min);
    width: 100%;
  }
  .fetchBtn {
    flex: 1;
    min-height: var(--touch-target-min);
  }
  .bookmarkBtn {
    flex: 1;
    min-height: var(--touch-target-min);
    justify-content: center;
  }
}
</style>
