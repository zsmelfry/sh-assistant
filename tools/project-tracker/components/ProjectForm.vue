<template>
  <BaseModal :open="open" title="新建事项" @close="$emit('close')">
    <form @submit.prevent="handleSubmit">
      <div class="formGroup">
        <label>标题 *</label>
        <input v-model="form.title" type="text" required placeholder="事项标题" />
      </div>

      <div class="formGroup">
        <label>分类 *</label>
        <select v-model="form.categoryId" required>
          <option value="" disabled>选择分类</option>
          <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
        </select>
      </div>

      <div class="formRow">
        <div class="formGroup">
          <label>优先级</label>
          <select v-model="form.priority">
            <option value="low">低</option>
            <option value="medium">中</option>
            <option value="high">高</option>
          </select>
        </div>

        <div class="formGroup">
          <label>截止日期</label>
          <input v-model="form.dueDate" type="date" />
        </div>
      </div>

      <div class="formGroup">
        <label>描述</label>
        <textarea v-model="form.description" rows="3" placeholder="详细描述（可选）" />
      </div>
    </form>

    <template #footer>
      <BaseButton variant="ghost" @click="$emit('close')">取消</BaseButton>
      <BaseButton :disabled="!form.title || !form.categoryId" @click="handleSubmit">创建</BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import type { Category, Tag, CreateProjectData } from '../types';

const props = defineProps<{
  open: boolean;
  categories: Category[];
  tags: Tag[];
}>();

const emit = defineEmits<{
  close: [];
  submit: [data: CreateProjectData];
}>();

const form = reactive({
  title: '',
  description: '',
  categoryId: '' as number | '',
  priority: 'medium' as 'low' | 'medium' | 'high',
  dueDate: '',
});

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    form.title = '';
    form.description = '';
    form.categoryId = props.categories[0]?.id ?? '';
    form.priority = 'medium';
    form.dueDate = '';
  }
});

function handleSubmit() {
  if (!form.title || !form.categoryId) return;
  emit('submit', {
    title: form.title,
    description: form.description || undefined,
    categoryId: form.categoryId as number,
    priority: form.priority,
    dueDate: form.dueDate || undefined,
  });
}
</script>

<style scoped>
.formGroup {
  margin-bottom: var(--spacing-md);
}

.formGroup label {
  display: block;
  margin-bottom: var(--spacing-xs);
  font-weight: 600;
  font-size: var(--font-size-sm);
}

.formGroup input,
.formGroup select,
.formGroup textarea {
  width: 100%;
  padding: var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-base);
  background: var(--color-bg);
  color: var(--color-text-primary);
}

.formRow {
  display: flex;
  gap: var(--spacing-md);
}

.formRow .formGroup {
  flex: 1;
}
</style>
