<template>
  <div class="checklistTab">
    <!-- Progress bar -->
    <ProgressBar v-if="progress" :progress="progress" />

    <!-- Milestone groups -->
    <div class="milestoneList">
      <MilestoneGroup
        v-for="group in groups"
        :key="group.id"
        :milestone="group"
        @edit-milestone="editMilestone = group"
        @delete-milestone="deletingMilestoneId = group.id"
        @toggle-item="handleToggle($event)"
        @edit-item="editItem = $event"
        @delete-item="handleDeleteItem($event)"
        @add-item="handleAddItem($event, $args)"
      />
    </div>

    <!-- Add milestone button -->
    <div class="addMilestoneRow">
      <input
        v-if="showMilestoneInput"
        v-model="newMilestoneName"
        type="text"
        placeholder="里程碑名称"
        class="milestoneInput"
        @keydown.enter="handleAddMilestone"
        @keydown.escape="showMilestoneInput = false"
      />
      <BaseButton v-else variant="ghost" size="sm" @click="showMilestoneInput = true">
        + 添加里程碑
      </BaseButton>
    </div>

    <!-- Edit milestone modal -->
    <BaseModal :open="!!editMilestone" title="编辑里程碑" @close="editMilestone = null">
      <div class="formGroup">
        <label>名称</label>
        <input v-model="editMilestoneForm.title" type="text" />
      </div>
      <div class="formGroup">
        <label>截止日期</label>
        <input v-model="editMilestoneForm.dueDate" type="date" />
      </div>
      <template #footer>
        <BaseButton variant="ghost" @click="editMilestone = null">取消</BaseButton>
        <BaseButton @click="handleUpdateMilestone">保存</BaseButton>
      </template>
    </BaseModal>

    <!-- Edit item modal -->
    <BaseModal :open="!!editItem" title="编辑任务" @close="editItem = null">
      <div class="formGroup">
        <label>内容</label>
        <input v-model="editItemForm.content" type="text" />
      </div>
      <div class="formGroup">
        <label>截止日期</label>
        <input v-model="editItemForm.dueDate" type="date" />
      </div>
      <template #footer>
        <BaseButton variant="ghost" @click="editItem = null">取消</BaseButton>
        <BaseButton @click="handleUpdateItem">保存</BaseButton>
      </template>
    </BaseModal>

    <!-- Delete milestone confirm -->
    <ConfirmDialog
      :open="!!deletingMilestoneId"
      title="删除里程碑"
      message="确定要删除这个里程碑吗？任务将移至未分组。"
      @confirm="handleDeleteMilestone"
      @cancel="deletingMilestoneId = null"
    />
  </div>
</template>

<script setup lang="ts">
import type { MilestoneWithItems, ChecklistItem, ProgressData } from '../types';
import ProgressBar from './ProgressBar.vue';
import MilestoneGroup from './MilestoneGroup.vue';

const props = defineProps<{
  projectId: number;
}>();

const groups = ref<MilestoneWithItems[]>([]);
const progress = ref<ProgressData | null>(null);
const showMilestoneInput = ref(false);
const newMilestoneName = ref('');
const editMilestone = ref<MilestoneWithItems | null>(null);
const editItem = ref<ChecklistItem | null>(null);
const deletingMilestoneId = ref<number | null>(null);

const editMilestoneForm = reactive({ title: '', dueDate: '' });
const editItemForm = reactive({ content: '', dueDate: '' });

watch(() => editMilestone.value, (m) => {
  if (m) {
    editMilestoneForm.title = m.title;
    editMilestoneForm.dueDate = m.dueDate || '';
  }
});

watch(() => editItem.value, (item) => {
  if (item) {
    editItemForm.content = item.content;
    editItemForm.dueDate = item.dueDate || '';
  }
});

async function loadData() {
  const [checklistData, progressData] = await Promise.all([
    $fetch<MilestoneWithItems[]>(`/api/project-tracker/projects/${props.projectId}/checklist`),
    $fetch<ProgressData>(`/api/project-tracker/projects/${props.projectId}/progress`),
  ]);
  groups.value = checklistData;
  progress.value = progressData;
}

onMounted(loadData);

async function handleToggle(itemId: number) {
  await $fetch(`/api/project-tracker/projects/${props.projectId}/checklist/${itemId}/toggle`, { method: 'POST' });
  await loadData();
}

async function handleAddItem(content: string, milestoneId: number | null) {
  await $fetch(`/api/project-tracker/projects/${props.projectId}/checklist`, {
    method: 'POST',
    body: { content, milestoneId },
  });
  await loadData();
}

async function handleDeleteItem(itemId: number) {
  await $fetch(`/api/project-tracker/projects/${props.projectId}/checklist/${itemId}`, { method: 'DELETE' });
  await loadData();
}

async function handleUpdateItem() {
  if (!editItem.value) return;
  await $fetch(`/api/project-tracker/projects/${props.projectId}/checklist/${editItem.value.id}`, {
    method: 'PUT',
    body: {
      content: editItemForm.content,
      dueDate: editItemForm.dueDate || null,
    },
  });
  editItem.value = null;
  await loadData();
}

async function handleAddMilestone() {
  const title = newMilestoneName.value.trim();
  if (!title) return;
  await $fetch(`/api/project-tracker/projects/${props.projectId}/milestones`, {
    method: 'POST',
    body: { title },
  });
  newMilestoneName.value = '';
  showMilestoneInput.value = false;
  await loadData();
}

async function handleUpdateMilestone() {
  if (!editMilestone.value) return;
  await $fetch(`/api/project-tracker/projects/${props.projectId}/milestones/${editMilestone.value.id}`, {
    method: 'PUT',
    body: {
      title: editMilestoneForm.title,
      dueDate: editMilestoneForm.dueDate || null,
    },
  });
  editMilestone.value = null;
  await loadData();
}

async function handleDeleteMilestone() {
  if (!deletingMilestoneId.value) return;
  await $fetch(`/api/project-tracker/projects/${props.projectId}/milestones/${deletingMilestoneId.value}`, {
    method: 'DELETE',
  });
  deletingMilestoneId.value = null;
  await loadData();
}
</script>

<style scoped>
.checklistTab {
  padding: var(--spacing-sm) 0;
}

.milestoneList {
  margin-bottom: var(--spacing-md);
}

.addMilestoneRow {
  padding: var(--spacing-sm) 0;
}

.milestoneInput {
  width: 100%;
  padding: var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
}

.formGroup {
  margin-bottom: var(--spacing-md);
}

.formGroup label {
  display: block;
  margin-bottom: var(--spacing-xs);
  font-weight: 600;
  font-size: 13px;
}

.formGroup input {
  width: 100%;
  padding: var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
}
</style>
