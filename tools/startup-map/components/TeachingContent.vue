<template>
  <div class="teachingContent">
    <!-- No content yet, not generating -->
    <div v-if="!teaching && !generating" class="emptyTeaching">
      <p class="emptyTitle">教学内容尚未生成</p>
      <p class="emptyHint">点击下方按钮，AI 将根据知识点和你的产品背景生成教学内容</p>
      <button class="generateBtn primary" @click="$emit('generate')">
        生成教学内容
      </button>
    </div>

    <!-- Sections (existing or streaming) -->
    <template v-if="teaching || generating">
      <div
        v-for="section in TEACHING_SECTIONS"
        :key="section"
        class="section"
      >
        <button
          class="sectionHeader"
          @click="toggleSection(section)"
        >
          <ChevronRight
            :size="16"
            class="chevron"
            :class="{ expanded: expandedSections.has(section) }"
          />
          <span class="sectionTitle">{{ TEACHING_SECTION_LABELS[section] }}</span>
        </button>

        <div v-if="expandedSections.has(section)" class="sectionBody">
          <!-- Streaming content -->
          <template v-if="generating && streamingSections[section]">
            <div class="markdownContent" v-html="renderMarkdown(streamingSections[section])" />
          </template>

          <!-- Existing content -->
          <template v-else-if="teaching && teaching[section]">
            <div class="markdownContent" v-html="renderMarkdown(teaching[section]!)" />
          </template>

          <!-- Loading skeleton during generation -->
          <template v-else-if="generating">
            <div class="skeleton">
              <div class="skeletonLine long" />
              <div class="skeletonLine medium" />
              <div class="skeletonLine short" />
            </div>
          </template>

          <!-- No content -->
          <template v-else>
            <p class="noContent">暂无内容</p>
          </template>
        </div>
      </div>

      <!-- Regenerate button -->
      <button
        v-if="teaching && !generating"
        class="generateBtn secondary"
        @click="showRegenConfirm = true"
      >
        重新生成
      </button>

      <!-- Regenerate confirmation dialog -->
      <Teleport to="body">
        <div v-if="showRegenConfirm" class="dialogOverlay" @click.self="showRegenConfirm = false">
          <div class="dialogBox">
            <p class="dialogText">
              确定重新生成教学内容吗？<br />
              现有内容将被覆盖，但笔记、对话和任务不受影响。
            </p>
            <div class="dialogActions">
              <button class="dialogBtn cancel" @click="showRegenConfirm = false">取消</button>
              <button class="dialogBtn confirm" @click="confirmRegenerate">确认重新生成</button>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- Generating indicator -->
      <div v-if="generating" class="generatingHint">
        正在生成教学内容...
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ChevronRight } from 'lucide-vue-next';
import { marked } from 'marked';
import {
  TEACHING_SECTIONS,
  TEACHING_SECTION_LABELS,
} from '../types';
import type { SmTeaching, TeachingSection } from '../types';

defineProps<{
  teaching: SmTeaching | null;
  generating: boolean;
  streamingSections: Record<TeachingSection, string>;
}>();

const expandedSections = ref(new Set<TeachingSection>(TEACHING_SECTIONS));
const showRegenConfirm = ref(false);

function toggleSection(section: TeachingSection) {
  const next = new Set(expandedSections.value);
  if (next.has(section)) {
    next.delete(section);
  } else {
    next.add(section);
  }
  expandedSections.value = next;
}

function renderMarkdown(content: string): string {
  return marked.parse(content) as string;
}

function confirmRegenerate() {
  showRegenConfirm.value = false;
  emit('regenerate');
}

const emit = defineEmits<{
  generate: [];
  regenerate: [];
}>();
</script>

<style scoped>
.teachingContent {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

/* Empty state */
.emptyTeaching {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-xl);
  gap: var(--spacing-sm);
}

.emptyTitle {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.emptyHint {
  font-size: 14px;
  color: var(--color-text-secondary);
  text-align: center;
  max-width: 400px;
}

/* Sections */
.section {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.sectionHeader {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  border: none;
  background: var(--color-bg-sidebar);
  cursor: pointer;
  text-align: left;
  transition: background-color var(--transition-fast);
}

.sectionHeader:hover {
  background: var(--color-bg-hover);
}

.chevron {
  transition: transform var(--transition-fast);
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.chevron.expanded {
  transform: rotate(90deg);
}

.sectionTitle {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.sectionBody {
  padding: var(--spacing-md);
}

.noContent {
  font-size: 13px;
  color: var(--color-text-disabled);
}

/* Buttons */
.generateBtn {
  padding: var(--spacing-sm) var(--spacing-lg);
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.generateBtn.primary {
  margin-top: var(--spacing-sm);
  border: 1px solid var(--color-accent);
  background: var(--color-accent);
  color: var(--color-accent-inverse);
}

.generateBtn.primary:hover {
  opacity: 0.85;
}

.generateBtn.secondary {
  align-self: flex-start;
  border: 1px solid var(--color-border);
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
}

.generateBtn.secondary:hover {
  background: var(--color-bg-hover);
}

/* Confirm dialog */
.dialogOverlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.dialogBox {
  background: var(--color-bg-primary);
  border-radius: var(--radius-md);
  padding: var(--spacing-lg);
  max-width: 400px;
  width: 90%;
}

.dialogText {
  font-size: 14px;
  color: var(--color-text-primary);
  line-height: 1.5;
  margin-bottom: var(--spacing-md);
}

.dialogActions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
}

.dialogBtn {
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.dialogBtn.cancel {
  border: 1px solid var(--color-border);
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
}

.dialogBtn.confirm {
  border: 1px solid var(--color-accent);
  background: var(--color-accent);
  color: var(--color-accent-inverse);
}

.generatingHint {
  font-size: 13px;
  color: var(--color-text-secondary);
  text-align: center;
  padding: var(--spacing-sm);
}

/* Skeleton loading */
.skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.skeletonLine {
  height: 14px;
  background: var(--color-bg-hover);
  border-radius: 3px;
  animation: shimmer 1.5s infinite;
}

.skeletonLine.long { width: 100%; }
.skeletonLine.medium { width: 75%; }
.skeletonLine.short { width: 50%; }

@keyframes shimmer {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

/* Markdown content — same deep styles as NoteEditor preview */
.markdownContent {
  font-size: 14px;
  line-height: 1.7;
  color: var(--color-text-primary);
}

.markdownContent :deep(h1),
.markdownContent :deep(h2),
.markdownContent :deep(h3),
.markdownContent :deep(h4) {
  margin-top: 1.2em;
  margin-bottom: 0.5em;
  font-weight: 600;
  line-height: 1.3;
}

.markdownContent :deep(h1) { font-size: 1.4em; }
.markdownContent :deep(h2) { font-size: 1.25em; }
.markdownContent :deep(h3) { font-size: 1.1em; }

.markdownContent :deep(p) { margin-bottom: 0.8em; }

.markdownContent :deep(blockquote) {
  margin: var(--spacing-sm) 0;
  padding: var(--spacing-xs) var(--spacing-md);
  border-left: 3px solid var(--color-border);
  color: var(--color-text-secondary);
}

.markdownContent :deep(pre) {
  margin: var(--spacing-sm) 0;
  padding: var(--spacing-sm);
  background: var(--color-bg-sidebar);
  border-radius: var(--radius-sm);
  overflow-x: auto;
  font-size: 13px;
}

.markdownContent :deep(code) {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 0.9em;
}

.markdownContent :deep(:not(pre) > code) {
  padding: 1px 4px;
  background: var(--color-bg-sidebar);
  border-radius: 3px;
}

.markdownContent :deep(ul),
.markdownContent :deep(ol) {
  margin-bottom: 0.8em;
  padding-left: 1.5em;
}

.markdownContent :deep(li) { margin-bottom: 0.3em; }

.markdownContent :deep(hr) {
  margin: var(--spacing-md) 0;
  border: none;
  border-top: 1px solid var(--color-border);
}

.markdownContent :deep(a) {
  color: var(--color-text-primary);
  text-decoration: underline;
}

.markdownContent :deep(strong) { font-weight: 600; }

.markdownContent :deep(table) {
  width: 100%;
  margin: var(--spacing-sm) 0;
  border-collapse: collapse;
  font-size: 13px;
}

.markdownContent :deep(th),
.markdownContent :deep(td) {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  text-align: left;
}

.markdownContent :deep(th) {
  background: var(--color-bg-sidebar);
  font-weight: 600;
}
</style>
