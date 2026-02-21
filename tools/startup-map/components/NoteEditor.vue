<template>
  <div class="noteEditor">
    <div class="editorHeader">
      <h3 class="sectionTitle">我的笔记</h3>
      <div class="headerRight">
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
          <template v-if="store.noteSaving">保存中...</template>
          <template v-else-if="lastSavedText">{{ lastSavedText }}</template>
        </span>
      </div>
    </div>

    <textarea
      v-if="mode === 'edit'"
      ref="textareaRef"
      v-model="draft"
      class="editorTextarea"
      placeholder="记录你的学习心得、调研结果..."
      @input="handleInput"
    />
    <div
      v-else
      class="previewContent"
      v-html="renderedMarkdown"
    />
  </div>
</template>

<script setup lang="ts">
import { marked } from 'marked';

const props = defineProps<{
  pointId: number;
}>();

const store = useStartupMapStore();
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const draft = ref('');
const mode = ref<'edit' | 'preview'>('edit');

const renderedMarkdown = computed(() => marked.parse(draft.value || '') as string);

const lastSavedText = computed(() => {
  if (!store.noteLastSaved) return null;
  const d = new Date(store.noteLastSaved);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `已保存 ${h}:${m}`;
});

let saveTimer: ReturnType<typeof setTimeout> | null = null;

// Load note on mount and point change
onMounted(() => loadAndSync());
watch(() => props.pointId, () => loadAndSync());

async function loadAndSync() {
  await store.loadNote(props.pointId);
  draft.value = store.note?.content ?? '';
}

// Sync draft when store note changes externally
watch(() => store.note, (n) => {
  if (n && n.content !== draft.value) {
    draft.value = n.content;
  }
});

function handleInput() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await store.saveNote(props.pointId, draft.value);
  }, 1000);
}

onUnmounted(() => {
  // Save immediately if there are pending changes
  if (saveTimer) {
    clearTimeout(saveTimer);
    const currentContent = store.note?.content ?? '';
    if (draft.value !== currentContent) {
      store.saveNote(props.pointId, draft.value);
    }
  }
});
</script>

<style scoped>
.noteEditor {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.editorHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.sectionTitle {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.headerRight {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
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
  white-space: nowrap;
}

/* Textarea */
.editorTextarea {
  width: 100%;
  min-height: 150px;
  padding: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;
  line-height: 1.6;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  resize: vertical;
  outline: none;
  transition: border-color var(--transition-fast);
}

.editorTextarea:focus {
  border-color: var(--color-accent);
}

.editorTextarea::placeholder {
  color: var(--color-text-disabled);
}

/* Preview */
.previewContent {
  min-height: 150px;
  padding: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  line-height: 1.7;
  color: var(--color-text-primary);
}

.previewContent:empty::before {
  content: '暂无内容';
  color: var(--color-text-disabled);
}

.previewContent :deep(h1),
.previewContent :deep(h2),
.previewContent :deep(h3),
.previewContent :deep(h4) {
  margin-top: 1.2em;
  margin-bottom: 0.5em;
  font-weight: 600;
  line-height: 1.3;
}

.previewContent :deep(h1) { font-size: 1.4em; }
.previewContent :deep(h2) { font-size: 1.25em; }
.previewContent :deep(h3) { font-size: 1.1em; }

.previewContent :deep(p) { margin-bottom: 0.8em; }

.previewContent :deep(blockquote) {
  margin: var(--spacing-sm) 0;
  padding: var(--spacing-xs) var(--spacing-md);
  border-left: 3px solid var(--color-border);
  color: var(--color-text-secondary);
}

.previewContent :deep(pre) {
  margin: var(--spacing-sm) 0;
  padding: var(--spacing-sm);
  background: var(--color-bg-sidebar);
  border-radius: var(--radius-sm);
  overflow-x: auto;
  font-size: 13px;
}

.previewContent :deep(code) {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 0.9em;
}

.previewContent :deep(:not(pre) > code) {
  padding: 1px 4px;
  background: var(--color-bg-sidebar);
  border-radius: 3px;
}

.previewContent :deep(ul),
.previewContent :deep(ol) {
  margin-bottom: 0.8em;
  padding-left: 1.5em;
}

.previewContent :deep(li) { margin-bottom: 0.3em; }

.previewContent :deep(hr) {
  margin: var(--spacing-md) 0;
  border: none;
  border-top: 1px solid var(--color-border);
}

.previewContent :deep(a) {
  color: var(--color-text-primary);
  text-decoration: underline;
}

.previewContent :deep(strong) { font-weight: 600; }

@media (max-width: 768px) {
  .editorTextarea {
    min-height: 120px;
  }
}
</style>
