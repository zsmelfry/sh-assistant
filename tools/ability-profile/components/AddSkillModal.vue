<template>
  <BaseModal :open="open" title="添加技能" max-width="560px" @close="$emit('close')">
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
    </div>

    <template #footer>
      <BaseButton v-if="step !== 'source'" variant="ghost" @click="goBack">返回</BaseButton>
      <BaseButton v-else variant="ghost" @click="$emit('close')">取消</BaseButton>
      <BaseButton
        v-if="step === 'template'"
        :disabled="!selectedTemplate"
        @click="handleTemplateSubmit"
      >
        添加
      </BaseButton>
      <BaseButton
        v-if="step === 'custom'"
        :disabled="!form.name.trim() || !form.categoryId"
        @click="handleCustomSubmit"
      >
        创建
      </BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import type { AbilityCategory, SkillTemplate } from '../types';

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
  }];
}>();

const step = ref<'source' | 'template' | 'custom'>('source');
const selectedTemplate = ref<string | null>(null);
const form = ref({
  name: '',
  categoryId: 0,
  description: '',
});

watch(() => props.open, (val) => {
  if (val) {
    step.value = 'source';
    selectedTemplate.value = null;
    form.value = { name: '', categoryId: 0, description: '' };
  }
});

function selectSource(source: 'template' | 'custom') {
  step.value = source;
}

function goBack() {
  step.value = 'source';
}

function handleTemplateSubmit() {
  if (!selectedTemplate.value) return;
  const template = props.templates.find((t) => t.id === selectedTemplate.value);
  if (!template) return;

  const category = props.categories.find((c) => c.name === template.categoryKey);
  if (!category) return;

  emit('create', {
    name: template.name,
    categoryId: category.id,
    description: template.description,
    source: 'template',
    templateId: template.id,
  });
}

function handleCustomSubmit() {
  if (!form.value.name.trim() || !form.value.categoryId) return;
  emit('create', {
    name: form.value.name.trim(),
    categoryId: form.value.categoryId,
    description: form.value.description.trim() || undefined,
    source: 'custom',
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
</style>
