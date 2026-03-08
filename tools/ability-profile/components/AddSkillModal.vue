<template>
  <BaseModal :open="open" :title="modalTitle" max-width="640px" @close="$emit('close')">
    <div class="add-skill">
      <!-- Step 1: Choose source -->
      <div v-if="step === 'source'" class="source-options">
        <div class="source-option" @click="selectSource('template')">
          <span class="source-icon">📋</span>
          <div>
            <div class="source-name">从模板添加</div>
            <div class="source-desc">选择预置技能模板，自动生成里程碑</div>
          </div>
        </div>
        <div class="source-option" @click="selectSource('custom')">
          <span class="source-icon">✏️</span>
          <div>
            <div class="source-name">自定义创建</div>
            <div class="source-desc">完全自由创建技能和里程碑</div>
          </div>
        </div>
      </div>

      <!-- Step 2a: Template selection -->
      <div v-else-if="step === 'template'">
        <div class="template-list">
          <div
            v-for="t in templates"
            :key="t.id"
            class="template-item"
            :class="{ 'template-item--selected': selectedTemplate === t.id }"
            @click="selectedTemplate = t.id"
          >
            <div class="template-name">{{ t.name }}</div>
            <div class="template-meta">
              <span>{{ t.categoryKey }}</span>
              <span>{{ t.milestoneCount }} 个里程碑</span>
            </div>
            <div class="template-desc">{{ t.description }}</div>
          </div>
        </div>
      </div>

      <!-- Step 2b: Custom skill form -->
      <div v-else-if="step === 'custom'" class="custom-form">
        <div class="field">
          <label class="field-label">技能名称 *</label>
          <input v-model="form.name" type="text" class="field-input" placeholder="如：吉他、游泳" />
        </div>
        <div class="field">
          <label class="field-label">所属大类 *</label>
          <select v-model="form.categoryId" class="field-input">
            <option :value="0" disabled>选择能力大类</option>
            <option v-for="cat in categories" :key="cat.id" :value="cat.id">
              {{ cat.name }}
            </option>
          </select>
        </div>
        <div class="field">
          <label class="field-label">描述</label>
          <textarea v-model="form.description" class="field-input" rows="2" placeholder="可选" />
        </div>
      </div>

      <!-- Step 3: Preview milestones & badges -->
      <div v-else-if="step === 'preview'" class="preview-section">
        <!-- Skill info summary -->
        <div class="preview-summary">
          <strong>{{ previewSkillName }}</strong>
          <span class="preview-category">{{ previewCategoryName }}</span>
        </div>

        <!-- Milestones by tier -->
        <div class="preview-milestones">
          <div v-for="tier in [1, 2, 3, 4, 5]" :key="tier" class="preview-tier">
            <template v-if="milestonesInTier(tier).length > 0">
              <div class="preview-tier-header">
                <span class="preview-tier-name">{{ TIER_NAMES[tier] }}</span>
                <span class="preview-tier-stars">
                  <span v-for="s in tier" :key="s">★</span>
                </span>
                <span class="preview-tier-count">{{ milestonesInTier(tier).length }} 个</span>
              </div>
              <div class="preview-tier-list">
                <div
                  v-for="(m, idx) in milestonesInTier(tier)"
                  :key="idx"
                  class="preview-milestone"
                >
                  <div v-if="editingIdx !== getMilestoneGlobalIdx(tier, idx)" class="preview-milestone-view">
                    <div class="preview-milestone-left">
                      <span class="pm-type">{{ MILESTONE_TYPE_LABELS[m.type] }}</span>
                      <span class="pm-title">{{ m.title }}</span>
                    </div>
                    <div class="preview-milestone-actions">
                      <span class="pm-verify">{{ VERIFY_METHOD_LABELS[m.verify] }}</span>
                      <button class="pm-edit-btn" @click="startEdit(tier, idx)">编辑</button>
                      <button class="pm-delete-btn" @click="removeMilestone(tier, idx)">删除</button>
                    </div>
                  </div>
                  <div v-else class="preview-milestone-edit">
                    <input
                      v-model="editForm.title"
                      type="text"
                      class="field-input pm-edit-input"
                      placeholder="里程碑标题"
                    />
                    <textarea
                      v-model="editForm.description"
                      class="field-input pm-edit-textarea"
                      rows="1"
                      placeholder="描述（可选）"
                    />
                    <div class="pm-edit-row">
                      <select v-model="editForm.type" class="field-input pm-edit-select">
                        <option v-for="(label, key) in MILESTONE_TYPE_LABELS" :key="key" :value="key">{{ label }}</option>
                      </select>
                      <select v-model="editForm.verify" class="field-input pm-edit-select">
                        <option v-for="(label, key) in VERIFY_METHOD_LABELS" :key="key" :value="key">{{ label }}</option>
                      </select>
                      <button class="pm-save-btn" @click="saveEdit(tier, idx)">保存</button>
                      <button class="pm-cancel-btn" @click="editingIdx = -1">取消</button>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>

        <!-- AI refinement -->
        <div class="ai-refine">
          <div class="ai-refine-header">AI 调整</div>
          <div class="ai-refine-input-row">
            <input
              v-model="refinePrompt"
              type="text"
              class="field-input ai-refine-input"
              placeholder="如：降低入门难度、增加精通段位的里程碑..."
              :disabled="aiLoading"
              @keydown.enter="handleAiRefine"
            />
            <BaseButton
              :disabled="!refinePrompt.trim() || aiLoading"
              @click="handleAiRefine"
            >
              {{ aiLoading ? '生成中...' : '调整' }}
            </BaseButton>
          </div>
        </div>

        <!-- Badge preview -->
        <div class="badge-preview">
          <div class="badge-preview-title">可能获得的徽章</div>
          <div class="badge-preview-list">
            <div v-for="badge in potentialBadges" :key="badge.key" class="badge-preview-item">
              <span class="badge-icon">🏅</span>
              <div>
                <div class="badge-name">{{ badge.name }}</div>
                <div class="badge-desc">{{ badge.description }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <BaseButton v-if="step !== 'source'" variant="ghost" @click="goBack">返回</BaseButton>
      <BaseButton v-else variant="ghost" @click="$emit('close')">取消</BaseButton>
      <BaseButton
        v-if="step === 'template'"
        :disabled="!selectedTemplate"
        @click="goToPreviewFromTemplate"
      >
        下一步
      </BaseButton>
      <BaseButton
        v-if="step === 'custom'"
        :disabled="!form.name.trim() || !form.categoryId"
        @click="goToPreviewFromCustom"
      >
        下一步
      </BaseButton>
      <BaseButton
        v-if="step === 'preview'"
        :disabled="previewMilestones.length === 0 || aiLoading"
        @click="handleSubmit"
      >
        创建技能
      </BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import type { AbilityCategory, SkillTemplate, SkillTemplateDetail } from '../types';
import { TIER_NAMES, MILESTONE_TYPE_LABELS, VERIFY_METHOD_LABELS } from '../types';
import { useAbilityStore } from '~/stores/ability';

interface PreviewMilestone {
  tier: number;
  title: string;
  description: string | null;
  type: string;
  verify: string;
  config: Record<string, unknown>;
  sortOrder: number;
}

const props = defineProps<{
  open: boolean;
  categories: AbilityCategory[];
  templates: SkillTemplate[];
}>();

const emit = defineEmits<{
  close: [];
  create: [data: {
    name: string;
    categoryId: number;
    description?: string;
    source: 'template' | 'custom';
    templateId?: string;
    milestones?: Array<{
      tier: number; title: string; description?: string;
      type: string; verify: string; config?: Record<string, unknown>;
    }>;
  }];
}>();

const store = useAbilityStore();

const step = ref<'source' | 'template' | 'custom' | 'preview'>('source');
const selectedTemplate = ref<string | null>(null);
const form = ref({ name: '', categoryId: 0, description: '' });
const previewMilestones = ref<PreviewMilestone[]>([]);
const previewSource = ref<'template' | 'custom'>('template');
const previewTemplateId = ref<string | null>(null);
const aiLoading = ref(false);
const refinePrompt = ref('');
const editingIdx = ref(-1);
const editForm = ref({ title: '', description: '', type: '', verify: '' });

const modalTitle = computed(() => {
  if (step.value === 'preview') return '预览里程碑';
  return '添加技能';
});

const previewSkillName = computed(() => {
  if (previewSource.value === 'template' && selectedTemplate.value) {
    const t = props.templates.find((x) => x.id === selectedTemplate.value);
    return t?.name || '';
  }
  return form.value.name;
});

const previewCategoryName = computed(() => {
  if (previewSource.value === 'template' && selectedTemplate.value) {
    const t = props.templates.find((x) => x.id === selectedTemplate.value);
    return t?.categoryKey || '';
  }
  const cat = props.categories.find((c) => c.id === form.value.categoryId);
  return cat?.name || '';
});

const previewCategoryId = computed(() => {
  if (previewSource.value === 'template' && selectedTemplate.value) {
    const t = props.templates.find((x) => x.id === selectedTemplate.value);
    const cat = props.categories.find((c) => c.name === t?.categoryKey);
    return cat?.id || 0;
  }
  return form.value.categoryId;
});

const potentialBadges = computed(() => {
  const badges = [];
  if (previewMilestones.value.length > 0) {
    badges.push({ key: 'first_milestone', name: '第一步', description: '完成第一个里程碑即可获得' });
  }
  if (previewMilestones.value.some((m) => m.tier === 1)) {
    badges.push({ key: 'first_tier', name: '入门者', description: '完成所有入门段位里程碑' });
  }
  if (previewMilestones.value.some((m) => m.tier === 5)) {
    badges.push({ key: 'deep_mastery', name: '精深者', description: '达到卓越段位' });
  }
  badges.push({ key: 'lifelong_learner', name: '终身学习者', description: '同时在学3个以上技能' });
  return badges;
});

watch(() => props.open, (val) => {
  if (val) {
    step.value = 'source';
    selectedTemplate.value = null;
    form.value = { name: '', categoryId: 0, description: '' };
    previewMilestones.value = [];
    refinePrompt.value = '';
    editingIdx.value = -1;
    aiLoading.value = false;
  }
});

function selectSource(source: 'template' | 'custom') {
  step.value = source;
}

function goBack() {
  if (step.value === 'preview') {
    step.value = previewSource.value === 'template' ? 'template' : 'custom';
  } else {
    step.value = 'source';
  }
}

async function goToPreviewFromTemplate() {
  if (!selectedTemplate.value) return;
  previewSource.value = 'template';
  previewTemplateId.value = selectedTemplate.value;

  // Fetch full template detail
  try {
    const detail = await $fetch<SkillTemplateDetail>(`/api/skill-templates/${selectedTemplate.value}`);
    previewMilestones.value = detail.milestones.map((m, idx) => ({
      tier: m.tier,
      title: m.title,
      description: null,
      type: m.type,
      verify: m.verify,
      config: m.config || {},
      sortOrder: idx,
    }));
  } catch {
    previewMilestones.value = [];
  }
  step.value = 'preview';
}

async function goToPreviewFromCustom() {
  if (!form.value.name.trim() || !form.value.categoryId) return;
  previewSource.value = 'custom';
  previewTemplateId.value = null;

  // Auto-generate milestones via AI
  aiLoading.value = true;
  try {
    const result = await store.generateMilestonesPreview({
      name: form.value.name,
      description: form.value.description || undefined,
      categoryName: previewCategoryName.value,
    });
    previewMilestones.value = result.milestones;
  } catch {
    previewMilestones.value = [];
  } finally {
    aiLoading.value = false;
  }
  step.value = 'preview';
}

function milestonesInTier(tier: number): PreviewMilestone[] {
  return previewMilestones.value
    .filter((m) => m.tier === tier)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function getMilestoneGlobalIdx(tier: number, localIdx: number): number {
  const tierMs = milestonesInTier(tier);
  const m = tierMs[localIdx];
  return previewMilestones.value.indexOf(m);
}

function startEdit(tier: number, localIdx: number) {
  const m = milestonesInTier(tier)[localIdx];
  editForm.value = {
    title: m.title,
    description: m.description || '',
    type: m.type,
    verify: m.verify,
  };
  editingIdx.value = getMilestoneGlobalIdx(tier, localIdx);
}

function saveEdit(tier: number, localIdx: number) {
  const globalIdx = getMilestoneGlobalIdx(tier, localIdx);
  previewMilestones.value[globalIdx] = {
    ...previewMilestones.value[globalIdx],
    title: editForm.value.title,
    description: editForm.value.description || null,
    type: editForm.value.type,
    verify: editForm.value.verify,
  };
  editingIdx.value = -1;
}

function removeMilestone(tier: number, localIdx: number) {
  const globalIdx = getMilestoneGlobalIdx(tier, localIdx);
  previewMilestones.value.splice(globalIdx, 1);
}

async function handleAiRefine() {
  if (!refinePrompt.value.trim() || aiLoading.value) return;
  aiLoading.value = true;
  try {
    const result = await store.generateMilestonesPreview({
      name: previewSkillName.value,
      description: previewSource.value === 'custom' ? form.value.description : undefined,
      categoryName: previewCategoryName.value,
      currentMilestones: previewMilestones.value,
      refinementPrompt: refinePrompt.value,
    });
    previewMilestones.value = result.milestones;
    refinePrompt.value = '';
  } catch {
    // keep current milestones on error
  } finally {
    aiLoading.value = false;
  }
}

function handleSubmit() {
  emit('create', {
    name: previewSkillName.value,
    categoryId: previewCategoryId.value,
    description: previewSource.value === 'custom' ? (form.value.description.trim() || undefined) : undefined,
    source: previewSource.value,
    templateId: previewTemplateId.value || undefined,
    milestones: previewMilestones.value.map((m) => ({
      tier: m.tier,
      title: m.title,
      description: m.description || undefined,
      type: m.type,
      verify: m.verify,
      config: m.config,
    })),
  });
}
</script>

<style scoped>
.add-skill {
  min-height: 200px;
}

.source-options {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.source-option {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.source-option:hover {
  background-color: var(--color-bg-hover);
}

.source-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.source-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--color-text-primary);
}

.source-desc {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 2px;
}

.template-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  max-height: 360px;
  overflow-y: auto;
}

.template-item {
  padding: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.template-item:hover {
  background-color: var(--color-bg-hover);
}

.template-item--selected {
  border-color: var(--color-accent);
  background-color: var(--color-bg-hover);
}

.template-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--color-text-primary);
}

.template-meta {
  display: flex;
  gap: var(--spacing-sm);
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 2px;
}

.template-desc {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-top: var(--spacing-xs);
}

.custom-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.field-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.field-input {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  color: var(--color-text-primary);
  background-color: var(--color-bg-primary);
  font-family: inherit;
}

.field-input:focus {
  outline: none;
  border-color: var(--color-accent);
}

select.field-input {
  appearance: auto;
}

/* Preview section */
.preview-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  max-height: 480px;
  overflow-y: auto;
}

.preview-summary {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background-color: var(--color-bg-hover);
  border-radius: var(--radius-sm);
  font-size: 14px;
}

.preview-category {
  font-size: 12px;
  color: var(--color-text-secondary);
  padding: 2px 6px;
  background-color: var(--color-bg-primary);
  border-radius: var(--radius-sm);
}

.preview-milestones {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.preview-tier {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.preview-tier:empty {
  display: none;
}

.preview-tier-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) var(--spacing-md);
  background-color: var(--color-bg-hover);
  border-bottom: 1px solid var(--color-border);
  font-size: 13px;
}

.preview-tier-name {
  font-weight: 600;
  color: var(--color-text-primary);
}

.preview-tier-stars {
  font-size: 11px;
  color: var(--color-accent);
}

.preview-tier-count {
  margin-left: auto;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.preview-tier-list {
  padding: 0;
}

.preview-milestone {
  border-bottom: 1px solid var(--color-border);
  padding: var(--spacing-xs) var(--spacing-md);
}

.preview-milestone:last-child {
  border-bottom: none;
}

.preview-milestone-view {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-sm);
}

.preview-milestone-left {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex: 1;
  min-width: 0;
}

.pm-type {
  font-size: 11px;
  padding: 1px 5px;
  border-radius: var(--radius-sm);
  background-color: var(--color-bg-hover);
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.pm-title {
  font-size: 13px;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-milestone-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  flex-shrink: 0;
}

.pm-verify {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.pm-edit-btn,
.pm-delete-btn,
.pm-save-btn,
.pm-cancel-btn {
  background: none;
  border: none;
  font-size: 12px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
}

.pm-edit-btn:hover,
.pm-save-btn:hover {
  color: var(--color-text-primary);
  background-color: var(--color-bg-hover);
}

.pm-delete-btn:hover {
  color: var(--color-danger);
  background-color: var(--color-bg-hover);
}

.pm-cancel-btn:hover {
  color: var(--color-text-primary);
}

.preview-milestone-edit {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.pm-edit-input {
  font-size: 13px;
  padding: var(--spacing-xs) var(--spacing-sm);
}

.pm-edit-textarea {
  font-size: 12px;
  padding: var(--spacing-xs) var(--spacing-sm);
  resize: vertical;
}

.pm-edit-row {
  display: flex;
  gap: var(--spacing-xs);
  align-items: center;
}

.pm-edit-select {
  font-size: 12px;
  padding: 2px 4px;
  flex: 1;
}

/* AI refine */
.ai-refine {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-sm) var(--spacing-md);
}

.ai-refine-header {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-xs);
}

.ai-refine-input-row {
  display: flex;
  gap: var(--spacing-sm);
}

.ai-refine-input {
  flex: 1;
  font-size: 13px;
}

/* Badge preview */
.badge-preview {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-sm) var(--spacing-md);
}

.badge-preview-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-xs);
}

.badge-preview-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.badge-preview-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) 0;
}

.badge-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.badge-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.badge-desc {
  font-size: 11px;
  color: var(--color-text-secondary);
}
</style>
