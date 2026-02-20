<template>
  <div class="tagSelector" ref="selectorRef">
    <button
      class="tagToggle"
      :disabled="!store.isBookmarked"
      :title="store.isBookmarked ? '管理标签' : '请先收藏文章'"
      @click="open = !open"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
      <span class="tagToggleLabel">标签</span>
      <span v-if="store.articleTagIds.length > 0" class="tagCount">{{ store.articleTagIds.length }}</span>
    </button>

    <!-- Tag chips for current article -->
    <div v-if="currentTags.length > 0" class="currentTags">
      <span
        v-for="tag in currentTags"
        :key="tag.id"
        class="tagChip"
      >
        <span class="tagDot" :style="{ backgroundColor: tag.color || '#999' }" />
        {{ tag.name }}
      </span>
    </div>

    <!-- Dropdown panel -->
    <div v-if="open" class="dropdownPanel">
      <input
        ref="searchRef"
        v-model="searchQuery"
        class="tagSearch"
        type="text"
        placeholder="搜索或新建标签..."
        @keydown.enter.prevent="handleEnter"
      />

      <div class="tagList">
        <button
          v-for="tag in filteredTags"
          :key="tag.id"
          class="tagOption"
          :class="{ selected: store.articleTagIds.includes(tag.id) }"
          @click="toggleTag(tag.id)"
        >
          <span class="tagDot" :style="{ backgroundColor: tag.color || '#999' }" />
          <span class="tagName">{{ tag.name }}</span>
          <svg v-if="store.articleTagIds.includes(tag.id)" class="checkIcon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </button>

        <!-- Create new tag option -->
        <button
          v-if="searchQuery.trim() && !exactMatch"
          class="tagOption createOption"
          @click="handleCreate"
        >
          <span class="createPlus">+</span>
          <span>新建「{{ searchQuery.trim() }}」</span>
        </button>

        <div v-if="filteredTags.length === 0 && !searchQuery.trim()" class="emptyHint">
          还没有标签
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const store = useArticleReaderStore();
const selectorRef = ref<HTMLElement | null>(null);
const searchRef = ref<HTMLInputElement | null>(null);
const open = ref(false);
const searchQuery = ref('');

const currentTags = computed(() =>
  store.tags.filter(t => store.articleTagIds.includes(t.id)),
);

const filteredTags = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return store.tags;
  return store.tags.filter(t => t.name.toLowerCase().includes(q));
});

const exactMatch = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  return store.tags.some(t => t.name.toLowerCase() === q);
});

watch(open, (isOpen) => {
  if (isOpen) {
    if (store.tags.length === 0) store.loadTags();
    nextTick(() => searchRef.value?.focus());
  } else {
    searchQuery.value = '';
  }
});

async function toggleTag(tagId: number) {
  if (!store.currentArticle) return;
  const current = [...store.articleTagIds];
  const idx = current.indexOf(tagId);
  if (idx === -1) {
    current.push(tagId);
  } else {
    current.splice(idx, 1);
  }
  await store.setArticleTags(store.currentArticle.id, current);
}

async function handleCreate() {
  const name = searchQuery.value.trim();
  if (!name || !store.currentArticle) return;
  const tag = await store.createTag(name);
  searchQuery.value = '';
  // Auto-add the new tag to the article
  const current = [...store.articleTagIds, tag.id];
  await store.setArticleTags(store.currentArticle.id, current);
}

function handleEnter() {
  const q = searchQuery.value.trim();
  if (!q) return;
  if (exactMatch.value) {
    const tag = store.tags.find(t => t.name.toLowerCase() === q.toLowerCase());
    if (tag) toggleTag(tag.id);
  } else {
    handleCreate();
  }
}

// Close dropdown on outside click
function handleClickOutside(e: MouseEvent) {
  if (selectorRef.value && !selectorRef.value.contains(e.target as Node)) {
    open.value = false;
  }
}

onMounted(() => document.addEventListener('click', handleClickOutside));
onUnmounted(() => document.removeEventListener('click', handleClickOutside));
</script>

<style scoped>
.tagSelector {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}

.tagToggle {
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

.tagToggle:hover:not(:disabled) {
  background-color: var(--color-bg-hover);
}

.tagToggle:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tagToggleLabel {
  font-size: 13px;
}

.tagCount {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 9px;
  background-color: var(--color-accent);
  color: var(--color-accent-inverse);
  font-size: 11px;
  font-weight: 600;
}

.currentTags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

.tagChip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 12px;
  background-color: var(--color-bg-hover);
  font-size: 12px;
  color: var(--color-text-secondary);
}

.tagDot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* Dropdown */
.dropdownPanel {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 100;
  width: 240px;
  max-height: 300px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-primary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
}

.tagSearch {
  padding: var(--spacing-sm) var(--spacing-md);
  border: none;
  border-bottom: 1px solid var(--color-border);
  font-size: 13px;
  color: var(--color-text-primary);
  background: transparent;
  outline: none;
}

.tagSearch::placeholder {
  color: var(--color-text-disabled);
}

.tagList {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-xs) 0;
}

.tagOption {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  border: none;
  background: none;
  font-size: 13px;
  color: var(--color-text-primary);
  cursor: pointer;
  text-align: left;
  transition: background-color var(--transition-fast);
}

.tagOption:hover {
  background-color: var(--color-bg-hover);
}

.tagOption.selected {
  font-weight: 500;
}

.tagName {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.checkIcon {
  flex-shrink: 0;
  color: var(--color-accent);
}

.createOption {
  color: var(--color-text-secondary);
}

.createPlus {
  font-size: 16px;
  font-weight: 600;
  width: 8px;
  text-align: center;
}

.emptyHint {
  padding: var(--spacing-md);
  text-align: center;
  font-size: 13px;
  color: var(--color-text-disabled);
}

@media (max-width: 768px) {
  .tagToggle {
    min-height: var(--touch-target-min);
  }
  .dropdownPanel {
    width: calc(100vw - 32px);
    max-width: 300px;
  }
}
</style>
