<template>
  <Teleport to="body">
    <div class="overlay">
      <div class="wizard">
        <!-- Header -->
        <div class="wizardHeader">
          <div class="wizardTitleGroup">
            <h2 class="wizardTitle">{{ editing ? '编辑技能' : '创建技能' }}</h2>
            <button v-if="!editing" class="importBtn" @click="fileInputRef?.click()">导入模板</button>
          </div>
          <button class="closeBtn" @click="$emit('close')">
            <X :size="18" />
          </button>
        </div>
        <input ref="fileInputRef" type="file" accept=".json" style="display:none" @change="handleImportTemplate">

        <!-- Step indicators -->
        <div class="steps">
          <div
            v-for="(s, i) in stepLabels"
            :key="i"
            class="step"
            :class="{ active: step === i, done: step > i }"
          >
            <span class="stepNum">{{ i + 1 }}</span>
            <span class="stepLabel">{{ s }}</span>
          </div>
        </div>

        <!-- Body -->
        <div class="wizardBody">
          <!-- Step 0: Basic info -->
          <div v-if="step === 0" class="stepContent">
            <div class="field">
              <label class="fieldLabel" for="skillName">技能名称 *</label>
              <input
                id="skillName"
                v-model="form.name"
                class="fieldInput"
                placeholder="如：Python 编程、日式料理"
              />
            </div>
            <div class="field">
              <label class="fieldLabel" for="skillDesc">描述</label>
              <textarea
                id="skillDesc"
                v-model="form.description"
                class="fieldInput textarea"
                rows="3"
                placeholder="简要描述这个技能涵盖的知识范围"
              />
            </div>
            <div v-if="!editing" class="field">
              <label class="fieldLabel" for="skillId">技能 ID *</label>
              <input
                id="skillId"
                v-model="form.skillId"
                class="fieldInput"
                placeholder="小写字母、数字和连字符"
                :disabled="!!editing"
              />
              <span class="fieldHint">URL 路径标识，创建后不可修改</span>
            </div>
            <IconPicker v-model="form.icon" />
          </div>

          <!-- Step 1: Knowledge tree -->
          <div v-if="step === 1" class="stepContent">
            <div class="treeActions">
              <button
                type="button"
                class="actionBtn primary"
                :disabled="generating || !form.name"
                @click="handleGenerateTree"
              >
                {{ generating ? '生成中...' : (treeDomains.length > 0 ? '重新生成' : 'AI 生成知识树') }}
              </button>
              <span v-if="generating" class="genHint">通常需要 30-60 秒</span>
            </div>
            <div v-if="genError" class="errorMsg">{{ genError }}</div>
            <TreeEditor v-model="treeDomains" />
          </div>

          <!-- Step 2: Prompt templates -->
          <div v-if="step === 2" class="stepContent promptStep">
            <PromptEditor
              v-model="form.teachingSystemPrompt"
              label="教学系统提示词"
              :rows="8"
              placeholder="指导 AI 如何生成教学内容..."
            />
            <PromptEditor
              v-model="form.teachingUserPrompt"
              label="教学用户提示词"
              :rows="2"
              placeholder="触发生成教学内容的用户消息..."
            />
            <PromptEditor
              v-model="form.chatSystemPrompt"
              label="聊天系统提示词"
              :rows="6"
              placeholder="指导 AI 如何回答用户关于知识点的问题..."
            />
            <PromptEditor
              v-model="form.taskSystemPrompt"
              label="任务系统提示词"
              :rows="6"
              placeholder="指导 AI 如何生成实践任务..."
            />
            <PromptEditor
              v-model="form.taskUserPrompt"
              label="任务用户提示词"
              :rows="2"
              placeholder="触发生成任务的用户消息..."
            />
          </div>
        </div>

        <!-- Footer -->
        <div class="wizardFooter">
          <button
            v-if="step > 0"
            type="button"
            class="footerBtn secondary"
            @click="step--"
          >
            上一步
          </button>
          <div class="spacer" />
          <button
            v-if="step < 2"
            type="button"
            class="footerBtn primary"
            :disabled="!canNext"
            @click="step++"
          >
            下一步
          </button>
          <button
            v-else
            type="button"
            class="footerBtn primary"
            :disabled="saving || !canSave"
            @click="handleSave"
          >
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { X } from 'lucide-vue-next';
import IconPicker from './IconPicker.vue';
import TreeEditor from './TreeEditor.vue';
import PromptEditor from './PromptEditor.vue';
import type { SkillConfig, SkillExport, GeneratedDomain, GeneratedStage } from '../types';

const props = defineProps<{
  editing?: SkillConfig | null;
}>();

const emit = defineEmits<{
  close: [];
  saved: [];
}>();

const stepLabels = ['基本信息', '知识树', '提示词模板'];
const step = ref(0);
const saving = ref(false);
const generating = ref(false);
const genError = ref('');

const fileInputRef = ref<HTMLInputElement>();
const treeDomains = ref<GeneratedDomain[]>([]);
const treeStages = ref<GeneratedStage[]>([]);

const DEFAULT_TEACHING_SYSTEM = `你是一位资深的{{skill.name}}导师和教育专家。你正在为一个学习平台生成教学内容。

你需要为以下知识点生成教学内容：
- 所属领域：{{domain.name}}
- 所属主题：{{topic.name}}
- 知识点：{{point.name}}
- 简介：{{point.description}}

请按以下 5 个板块生成内容，每个板块使用 Markdown 格式。板块之间必须用 "---SECTION_BREAK---" 分隔（单独一行）：

1. **是什么 (What)** — 概念定义，重要性
2. **怎么做 (How)** — 通用方法论、执行步骤、框架和工具
3. **案例 (Example)** — 1-2 个真实案例
4. **我的应用 (Apply)** — 提出 2-3 个引导思考问题
5. **推荐资源 (Resources)** — 推荐书籍、网站、工具、课程

要求：
- 内容深入实用，不要泛泛而谈
- 每个板块 300-800 字
- 直接输出内容，不要重复板块标题`;

const DEFAULT_TEACHING_USER = '请为"{{point.name}}"生成教学内容。';

const DEFAULT_CHAT_SYSTEM = `你是一位经验丰富的{{skill.name}}导师。用户正在学习以下知识点，请帮助用户深入理解并应用到实际场景中。

知识点信息：
- 领域：{{domain.name}}
- 主题：{{topic.name}}
- 知识点：{{point.name}} — {{point.description}}
{{teachingSummary}}

你的角色：
1. 回答用户关于该知识点的疑问
2. 针对用户的场景提出思考问题
3. 纠正可能的误解
4. 建议下一步行动`;

const DEFAULT_TASK_SYSTEM = `你是一位资深的{{skill.name}}导师。你需要为学习平台的知识点生成实践任务。

知识点信息：
- 所属领域：{{domain.name}}
- 所属主题：{{topic.name}}
- 知识点：{{point.name}}
- 简介：{{point.description}}

请生成 2-3 个实践任务，帮助学习者将这个知识点应用到实际场景中。

严格按以下 JSON 格式输出（不要添加任何其他文字）：
[
  {
    "description": "任务描述（1-2句话，说明要做什么）",
    "expectedOutput": "预期产出（具体要交付什么）",
    "hint": "参考提示（帮助完成任务的建议）"
  }
]

要求：
- 任务要具体可执行，不要太抽象
- 预期产出要明确可衡量
- 参考提示要实用`;

const DEFAULT_TASK_USER = '请为"{{point.name}}"生成实践任务。';

const form = reactive({
  skillId: '',
  name: '',
  description: '',
  icon: 'BookOpen',
  teachingSystemPrompt: DEFAULT_TEACHING_SYSTEM,
  teachingUserPrompt: DEFAULT_TEACHING_USER,
  chatSystemPrompt: DEFAULT_CHAT_SYSTEM,
  taskSystemPrompt: DEFAULT_TASK_SYSTEM,
  taskUserPrompt: DEFAULT_TASK_USER,
});

// Initialize form for editing
if (props.editing) {
  form.skillId = props.editing.skillId;
  form.name = props.editing.name;
  form.description = props.editing.description || '';
  form.icon = props.editing.icon;
  form.teachingSystemPrompt = props.editing.teachingSystemPrompt;
  form.teachingUserPrompt = props.editing.teachingUserPrompt;
  form.chatSystemPrompt = props.editing.chatSystemPrompt;
  form.taskSystemPrompt = props.editing.taskSystemPrompt;
  form.taskUserPrompt = props.editing.taskUserPrompt;
}

const canNext = computed(() => {
  if (step.value === 0) {
    return form.name.trim() && (props.editing || form.skillId.trim());
  }
  return true;
});

const canSave = computed(() => {
  return form.name.trim() &&
    form.teachingSystemPrompt.trim() &&
    form.teachingUserPrompt.trim() &&
    form.chatSystemPrompt.trim() &&
    form.taskSystemPrompt.trim() &&
    form.taskUserPrompt.trim();
});

function handleImportTemplate(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result as string) as SkillExport;
      if (data.version !== 1 || !data.config || !data.tree) {
        alert('无效的模板文件：缺少 version、config 或 tree');
        return;
      }
      // Pre-fill config
      const c = data.config;
      form.name = c.name;
      form.description = c.description || '';
      form.icon = c.icon;
      form.skillId = c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      form.teachingSystemPrompt = c.teachingSystemPrompt;
      form.teachingUserPrompt = c.teachingUserPrompt;
      form.chatSystemPrompt = c.chatSystemPrompt;
      form.taskSystemPrompt = c.taskSystemPrompt;
      form.taskUserPrompt = c.taskUserPrompt;
      // Pre-fill tree (preserve teaching/note if present)
      treeDomains.value = data.tree.domains.map(d => ({
        name: d.name,
        description: d.description,
        topics: d.topics.map(t => ({
          name: t.name,
          description: t.description,
          points: t.points.map(p => ({
            name: p.name,
            description: p.description,
            ...(p.teaching ? { teaching: p.teaching } : {}),
            ...(p.note ? { note: p.note } : {}),
          })),
        })),
      }));
      treeStages.value = data.tree.stages.map(s => ({
        name: s.name,
        description: s.description,
        objective: s.objective,
        pointNames: s.pointNames,
      }));
    } catch {
      alert('无法解析文件，请确保是有效的 JSON 格式');
    }
    // Reset input so same file can be re-imported
    if (fileInputRef.value) fileInputRef.value.value = '';
  };
  reader.readAsText(file);
}

async function handleGenerateTree() {
  generating.value = true;
  genError.value = '';
  try {
    const result = await $fetch<{ domains: GeneratedDomain[]; stages: GeneratedStage[] }>(
      '/api/skill-configs/generate-tree',
      {
        method: 'POST',
        body: { name: form.name, description: form.description },
      },
    );
    treeDomains.value = result.domains;
    treeStages.value = result.stages;
  } catch (e: any) {
    genError.value = e?.data?.message || e?.message || '生成失败，请重试';
  } finally {
    generating.value = false;
  }
}

async function handleSave() {
  saving.value = true;
  try {
    if (props.editing) {
      // Update existing
      await $fetch(`/api/skill-configs/${props.editing.id}`, {
        method: 'PUT',
        body: {
          name: form.name,
          description: form.description || null,
          icon: form.icon,
          teachingSystemPrompt: form.teachingSystemPrompt,
          teachingUserPrompt: form.teachingUserPrompt,
          chatSystemPrompt: form.chatSystemPrompt,
          taskSystemPrompt: form.taskSystemPrompt,
          taskUserPrompt: form.taskUserPrompt,
        },
      });
    } else {
      // Create new skill config
      const created = await $fetch<SkillConfig>('/api/skill-configs', {
        method: 'POST',
        body: {
          skillId: form.skillId,
          name: form.name,
          description: form.description || null,
          icon: form.icon,
          teachingSystemPrompt: form.teachingSystemPrompt,
          teachingUserPrompt: form.teachingUserPrompt,
          chatSystemPrompt: form.chatSystemPrompt,
          taskSystemPrompt: form.taskSystemPrompt,
          taskUserPrompt: form.taskUserPrompt,
        },
      });

      // Seed knowledge tree if generated
      if (treeDomains.value.length > 0) {
        await $fetch(`/api/skills/${created.skillId}/seed`, {
          method: 'POST',
          body: {
            domains: treeDomains.value,
            stages: treeStages.value,
          },
        });
      }
    }
    emit('saved');
  } catch (e: any) {
    alert(e?.data?.message || e?.message || '保存失败');
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.wizard {
  background: var(--color-bg-primary);
  border-radius: var(--radius-md);
  width: 90%;
  max-width: 720px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.wizardHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md) var(--spacing-lg);
  border-bottom: 1px solid var(--color-border);
}

.wizardTitleGroup {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.wizardTitle {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.importBtn {
  padding: var(--spacing-xs) var(--spacing-sm);
  font-size: 12px;
  color: var(--color-text-secondary);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: color var(--transition-fast);
}

.importBtn:hover {
  color: var(--color-text-primary);
}

.closeBtn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text-secondary);
  padding: var(--spacing-xs);
  border-radius: var(--radius-sm);
  transition: color var(--transition-fast);
}

.closeBtn:hover {
  color: var(--color-text-primary);
}

/* Steps */
.steps {
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg);
  border-bottom: 1px solid var(--color-border);
}

.step {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: 13px;
  color: var(--color-text-disabled);
}

.step.active {
  color: var(--color-text-primary);
  font-weight: 600;
}

.step.done {
  color: var(--color-text-secondary);
}

.stepNum {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 600;
  border: 1.5px solid currentColor;
}

.step.active .stepNum {
  background: var(--color-accent);
  color: var(--color-accent-inverse);
  border-color: var(--color-accent);
}

.step.done .stepNum {
  background: var(--color-bg-hover);
  border-color: var(--color-border);
}

/* Body */
.wizardBody {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-lg);
}

.stepContent {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.promptStep {
  gap: var(--spacing-lg);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.fieldLabel {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.fieldInput {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  font-family: inherit;
}

.fieldInput:focus {
  border-color: var(--color-accent);
  outline: none;
}

.fieldInput.textarea {
  resize: vertical;
  line-height: 1.5;
}

.fieldInput:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.fieldHint {
  font-size: 12px;
  color: var(--color-text-secondary);
}

/* Tree actions */
.treeActions {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.genHint {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.errorMsg {
  font-size: 13px;
  color: var(--color-danger);
  padding: var(--spacing-sm);
  background: var(--color-danger-bg);
  border-radius: var(--radius-sm);
}

/* Footer */
.wizardFooter {
  display: flex;
  align-items: center;
  padding: var(--spacing-md) var(--spacing-lg);
  border-top: 1px solid var(--color-border);
}

.spacer {
  flex: 1;
}

.footerBtn,
.actionBtn {
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}

.footerBtn.primary,
.actionBtn.primary {
  background: var(--color-accent);
  color: var(--color-accent-inverse);
  border: 1px solid var(--color-accent);
}

.footerBtn.secondary {
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
}

.footerBtn:disabled,
.actionBtn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.footerBtn:hover:not(:disabled),
.actionBtn:hover:not(:disabled) {
  opacity: 0.85;
}

@media (max-width: 768px) {
  .wizard {
    width: 100%;
    height: 100%;
    max-width: none;
    max-height: none;
    border-radius: 0;
  }
  .steps {
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
  }
  .stepLabel {
    display: none;
  }
  .footerBtn,
  .actionBtn {
    min-height: var(--touch-target-min);
  }
}
</style>
