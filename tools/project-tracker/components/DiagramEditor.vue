<template>
  <div class="diagramEditor">
    <div class="editorHeader">
      <button class="backBtn" @click="$emit('back')">← 返回</button>
      <input
        v-model="title"
        type="text"
        class="titleInput"
        @blur="handleSave"
      />
      <BaseButton size="sm" @click="handleSave">保存</BaseButton>
    </div>

    <!-- AI Generate bar -->
    <div class="aiBar">
      <input
        v-model="aiPrompt"
        type="text"
        placeholder="描述你需要的图表..."
        @keydown.enter="handleGenerate"
      />
      <select v-model="diagramType">
        <option value="flowchart">流程图</option>
        <option value="sequence">时序图</option>
        <option value="gantt">甘特图</option>
        <option value="mindmap">思维导图</option>
        <option value="classDiagram">类图</option>
      </select>
      <BaseButton size="sm" :disabled="generating || !aiPrompt.trim()" @click="handleGenerate">
        {{ generating ? '生成中...' : 'AI 生成' }}
      </BaseButton>
    </div>

    <!-- Split view: code + preview -->
    <div class="splitView">
      <div class="codePane">
        <textarea
          v-model="code"
          class="codeArea"
          spellcheck="false"
          @blur="handleSave"
        />
      </div>
      <div class="previewPane">
        <div ref="previewEl" class="mermaidPreview" />
        <div v-if="renderError" class="renderError">{{ renderError }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Diagram } from '../types';

const props = defineProps<{
  diagram: Diagram;
  projectId: number;
}>();

const emit = defineEmits<{
  back: [];
  save: [data: { title: string; mermaidCode: string; type: string }];
}>();

const title = ref(props.diagram.title);
const code = ref(props.diagram.mermaidCode);
const diagramType = ref(props.diagram.type);
const aiPrompt = ref('');
const generating = ref(false);
const renderError = ref('');
const previewEl = ref<HTMLElement | null>(null);

let mermaidModule: any = null;

async function loadMermaid() {
  if (!mermaidModule) {
    mermaidModule = await import('mermaid');
    mermaidModule.default.initialize({
      startOnLoad: false,
      theme: 'neutral',
      securityLevel: 'strict',
    });
  }
  return mermaidModule.default;
}

async function renderDiagram() {
  if (!previewEl.value || !code.value.trim()) return;

  try {
    const mermaid = await loadMermaid();
    const id = `mermaid-${Date.now()}`;
    const { svg } = await mermaid.render(id, code.value);
    previewEl.value.innerHTML = svg;
    renderError.value = '';
  } catch (err: any) {
    renderError.value = err.message || '渲染错误';
    if (previewEl.value) {
      previewEl.value.innerHTML = '';
    }
  }
}

// Debounced render on code change
let renderTimer: ReturnType<typeof setTimeout>;
watch(code, () => {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(renderDiagram, 500);
});

onMounted(renderDiagram);

function handleSave() {
  emit('save', {
    title: title.value,
    mermaidCode: code.value,
    type: diagramType.value,
  });
}

async function handleGenerate() {
  if (!aiPrompt.value.trim()) return;
  generating.value = true;
  try {
    const result = await $fetch<{ mermaidCode: string; type: string }>(
      `/api/project-tracker/projects/${props.projectId}/diagrams/generate`,
      { method: 'POST', body: { description: aiPrompt.value, type: diagramType.value } },
    );
    code.value = result.mermaidCode;
    diagramType.value = result.type;
    aiPrompt.value = '';
  } finally {
    generating.value = false;
  }
}
</script>

<style scoped>
.diagramEditor {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.editorHeader {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
}

.backBtn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.backBtn:hover {
  color: var(--color-text-primary);
}

.titleInput {
  flex: 1;
  font-size: 16px;
  font-weight: 600;
  border: none;
  border-bottom: 1px solid var(--color-border);
  padding: var(--spacing-xs) 0;
  outline: none;
  background: transparent;
  color: var(--color-text-primary);
}

.aiBar {
  display: flex;
  gap: var(--spacing-xs);
  margin-bottom: var(--spacing-sm);
}

.aiBar input {
  flex: 1;
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
}

.aiBar select {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
}

.splitView {
  display: flex;
  gap: var(--spacing-sm);
  flex: 1;
  min-height: 400px;
}

.codePane,
.previewPane {
  flex: 1;
  min-width: 0;
}

.codeArea {
  width: 100%;
  height: 100%;
  min-height: 400px;
  padding: var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 13px;
  resize: none;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
}

.mermaidPreview {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--spacing-md);
  min-height: 400px;
  overflow: auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

.renderError {
  color: var(--color-danger);
  font-size: 12px;
  margin-top: var(--spacing-xs);
}

@media (max-width: 768px) {
  .splitView {
    flex-direction: column;
  }
}
</style>
