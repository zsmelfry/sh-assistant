<template>
  <div class="noteEditor">
    <button class="collapseHeader" @click="collapsed = !collapsed">
      <ChevronRight :size="16" class="chevron" :class="{ expanded: !collapsed }" />
      <h3 class="sectionTitle">我的笔记</h3>
    </button>

    <template v-if="!collapsed">
    <div class="editorHeader">
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
    </template>
  </div>
</template>

<script setup lang="ts">
import { ChevronRight } from 'lucide-vue-next';
import { marked } from 'marked';
import { SKILL_STORE_KEY } from '~/composables/skill-learning';

const props = defineProps<{
  pointId: number;
  productId?: number;
}>();

const store = inject(SKILL_STORE_KEY)!;
const collapsed = ref(true);
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
  await store.loadNote(props.pointId, props.productId);
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
    await store.saveNote(props.pointId, draft.value, props.productId);
  }, 1000);
}

onUnmounted(() => {
  // Save immediately if there are pending changes
  if (saveTimer) {
    clearTimeout(saveTimer);
    const currentContent = store.note?.content ?? '';
    if (draft.value !== currentContent) {
      store.saveNote(props.pointId, draft.value, props.productId);
    }
  }
});
</script>

<style scoped>
@import '~/assets/css/markdown-preview.css';

.noteEditor {
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
  margin: 0;
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

.previewContent {
  min-height: 150px;
}

@media (max-width: 768px) {
  .editorTextarea {
    min-height: 120px;
  }
}
</style>
