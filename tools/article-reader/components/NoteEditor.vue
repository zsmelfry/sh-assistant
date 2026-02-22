<template>
  <div class="noteEditor">
    <!-- Not bookmarked hint -->
    <div v-if="!store.isBookmarked" class="notBookmarked">
      <p class="notBookmarkedTitle">请先收藏文章</p>
      <p class="notBookmarkedHint">收藏后即可添加个人笔记</p>
    </div>

    <!-- Editor -->
    <template v-else>
      <div class="editorHeader">
        <div class="modeTabs">
          <button
            class="modeTab"
            :class="{ active: mode === 'edit' }"
            @click="mode = 'edit'"
          >编辑</button>
          <button
            class="modeTab"
            :class="{ active: mode === 'preview' }"
            @click="mode = 'preview'"
          >预览</button>
        </div>
        <span class="saveStatus">
          <template v-if="store.notesSaving">保存中...</template>
          <template v-else-if="saved">已保存</template>
        </span>
      </div>
      <textarea
        v-if="mode === 'edit'"
        ref="textareaRef"
        v-model="draft"
        class="editorTextarea"
        placeholder="在这里写笔记..."
        @input="handleInput"
      />
      <div
        v-else
        class="previewContent"
        v-html="renderedMarkdown"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { marked } from 'marked';

const store = useArticleReaderStore();
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const draft = ref(store.notes);
const mode = ref<'edit' | 'preview'>('edit');

const renderedMarkdown = computed(() => marked.parse(draft.value || '') as string);
const saved = ref(false);
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let savedTimer: ReturnType<typeof setTimeout> | null = null;

// Sync draft when store notes change (e.g. switching articles)
watch(() => store.notes, (val) => {
  draft.value = val;
  saved.value = false;
});

function handleInput() {
  saved.value = false;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await store.saveNotes(draft.value);
    saved.value = true;
    if (savedTimer) clearTimeout(savedTimer);
    savedTimer = setTimeout(() => { saved.value = false; }, 3000);
  }, 1000);
}

onUnmounted(() => {
  // Save immediately if there are pending changes
  if (saveTimer) {
    clearTimeout(saveTimer);
    if (draft.value !== store.notes) {
      store.saveNotes(draft.value);
    }
  }
  if (savedTimer) clearTimeout(savedTimer);
});
</script>

<style scoped>
@import '~/assets/css/markdown-preview.css';

.noteEditor {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* Not bookmarked state */
.notBookmarked {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  height: 100%;
  min-height: 200px;
}

.notBookmarkedTitle {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.notBookmarkedHint {
  font-size: 13px;
  color: var(--color-text-secondary);
}

/* Editor header */
.editorHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: var(--spacing-sm);
  min-height: 24px;
}

.modeTabs {
  display: flex;
  gap: 2px;
  background: var(--color-bg-sidebar);
  border-radius: var(--radius-sm);
  padding: 2px;
}

.modeTab {
  padding: 3px 10px;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 3px;
  transition: all var(--transition-fast);
}

.modeTab.active {
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}

.saveStatus {
  font-size: 12px;
  color: var(--color-text-secondary);
}

/* Textarea */
.editorTextarea {
  flex: 1;
  width: 100%;
  padding: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;
  line-height: 1.6;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  resize: none;
  outline: none;
  transition: border-color var(--transition-fast);
}

.editorTextarea:focus {
  border-color: var(--color-accent);
}

.editorTextarea::placeholder {
  color: var(--color-text-disabled);
}

.previewContent {
  flex: 1;
}

@media (max-width: 768px) {
  .editorTextarea {
    min-height: 200px;
  }
}
</style>
