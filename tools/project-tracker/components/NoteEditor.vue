<template>
  <div class="noteEditor">
    <div class="editorHeader">
      <BaseButton variant="ghost" size="sm" @click="previewMode = !previewMode">
        {{ previewMode ? '编辑' : '预览' }}
      </BaseButton>
    </div>

    <input
      :value="title"
      type="text"
      class="titleInput"
      placeholder="笔记标题"
      @input="$emit('update:title', ($event.target as HTMLInputElement).value)"
      @blur="$emit('save')"
    />

    <div v-if="note?.aiSummary" class="summaryBanner">
      <strong>AI 摘要：</strong>
      <div class="summaryContent" v-html="renderedSummary" />
    </div>

    <div class="editorBody">
      <textarea
        v-if="!previewMode"
        :value="content"
        class="contentArea"
        placeholder="开始写笔记...（支持 Markdown）"
        @input="$emit('update:content', ($event.target as HTMLTextAreaElement).value)"
        @blur="$emit('save')"
      />
      <div v-else class="previewArea" v-html="renderedContent" />
    </div>

    <!-- Attachments -->
    <div class="attachments">
      <h5>附件</h5>
      <div v-for="att in attachments" :key="att.id" class="attachmentItem">
        <template v-if="att.type === 'url'">
          <a :href="att.url!" target="_blank" rel="noopener">{{ att.caption || att.url }}</a>
        </template>
        <template v-else>
          <img :src="att.filePath!" :alt="att.caption || ''" class="attachedImage" />
          <span v-if="att.caption">{{ att.caption }}</span>
        </template>
        <button class="removeBtn" @click="$emit('remove-attachment', att.id)">&times;</button>
      </div>

      <div class="addAttachment">
        <BaseButton variant="ghost" size="sm" @click="showUrlInput = true">+ URL</BaseButton>
        <BaseButton variant="ghost" size="sm" @click="triggerUpload">+ 图片</BaseButton>
        <input ref="fileInput" type="file" accept="image/*" style="display:none" @change="handleFileChange" />
      </div>

      <div v-if="showUrlInput" class="urlInputRow">
        <input v-model="newUrl" type="url" placeholder="https://..." />
        <input v-model="newUrlCaption" type="text" placeholder="说明（可选）" />
        <BaseButton size="sm" @click="handleAddUrl">添加</BaseButton>
        <BaseButton variant="ghost" size="sm" @click="showUrlInput = false">取消</BaseButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Note, Attachment } from '../types';

const props = defineProps<{
  note: Note | null;
  title: string;
  content: string;
  attachments: Attachment[];
  summarizing: boolean;
}>();

const emit = defineEmits<{
  save: [];
  'update:title': [value: string];
  'update:content': [value: string];
  'add-url-attachment': [url: string, caption: string];
  'add-image-attachment': [file: File];
  'remove-attachment': [id: number];
}>();

const previewMode = ref(false);
const showUrlInput = ref(false);
const newUrl = ref('');
const newUrlCaption = ref('');
const fileInput = ref<HTMLInputElement | null>(null);

function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\n/g, '<br>');
}

const renderedSummary = computed(() => {
  if (!props.note?.aiSummary) return '';
  return renderMarkdown(props.note.aiSummary);
});

const renderedContent = computed(() => {
  if (!props.content) return '<p style="color: var(--color-text-disabled)">无内容</p>';
  return renderMarkdown(props.content);
});

function handleAddUrl() {
  if (!newUrl.value.trim()) return;
  emit('add-url-attachment', newUrl.value.trim(), newUrlCaption.value.trim());
  newUrl.value = '';
  newUrlCaption.value = '';
  showUrlInput.value = false;
}

function triggerUpload() {
  fileInput.value?.click();
}

function handleFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    emit('add-image-attachment', file);
  }
}
</script>

<style scoped>
.noteEditor {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.editorHeader {
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

.titleInput {
  font-size: 18px;
  font-weight: 700;
  border: none;
  border-bottom: 1px solid var(--color-border);
  padding: var(--spacing-sm) 0;
  outline: none;
  background: transparent;
  color: var(--color-text-primary);
}

.summaryBanner {
  padding: var(--spacing-sm);
  background: var(--color-bg-hover);
  border-radius: var(--radius-sm);
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.4;
}

.summaryContent {
  margin-top: var(--spacing-xs);
}

.summaryContent :deep(h1),
.summaryContent :deep(h2),
.summaryContent :deep(h3) {
  margin: var(--spacing-xs) 0;
  font-size: 13px;
  font-weight: 600;
}

.summaryContent :deep(li) {
  margin-left: var(--spacing-md);
  list-style: disc;
}

.editorBody {
  flex: 1;
  min-height: 300px;
}

.contentArea {
  width: 100%;
  min-height: 300px;
  padding: var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-family: monospace;
  font-size: 14px;
  resize: vertical;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
}

.previewArea {
  padding: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  min-height: 300px;
  line-height: 1.6;
}

.attachments {
  border-top: 1px solid var(--color-border);
  padding-top: var(--spacing-sm);
}

.attachments h5 {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-xs);
}

.attachmentItem {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) 0;
  font-size: 13px;
}

.attachmentItem a {
  color: var(--color-accent);
  text-decoration: underline;
}

.attachedImage {
  max-width: 120px;
  max-height: 80px;
  border-radius: var(--radius-sm);
}

.removeBtn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text-disabled);
  font-size: 14px;
}

.removeBtn:hover {
  color: var(--color-danger);
}

.addAttachment {
  display: flex;
  gap: var(--spacing-xs);
  margin-top: var(--spacing-xs);
}

.urlInputRow {
  display: flex;
  gap: var(--spacing-xs);
  margin-top: var(--spacing-xs);
}

.urlInputRow input {
  flex: 1;
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
}
</style>
