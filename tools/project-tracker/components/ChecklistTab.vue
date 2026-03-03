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
        @add-item="(content: string, milestoneId: number | null) => handleAddItem(content, milestoneId)"
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
      <div class="formGroup">
        <label>提醒时间</label>
        <input v-model="editMilestoneForm.reminderAt" type="datetime-local" />
      </div>
      <template #footer>
        <BaseButton variant="ghost" @click="editMilestone = null">取消</BaseButton>
        <BaseButton @click="handleUpdateMilestone">保存</BaseButton>
      </template>
    </BaseModal>

    <!-- Edit item modal -->
    <BaseModal :open="!!editItem" title="编辑任务" max-width="700px" @close="editItem = null">
      <div class="formGroup">
        <label>内容</label>
        <input v-model="editItemForm.content" type="text" />
      </div>
      <div class="formGroup">
        <label>详细描述</label>
        <div class="descToggle">
          <button
            class="toggleBtn"
            :class="{ active: !showDescPreview }"
            @click="showDescPreview = false"
          >编辑</button>
          <button
            class="toggleBtn"
            :class="{ active: showDescPreview }"
            @click="showDescPreview = true"
          >预览</button>
        </div>
        <textarea
          v-if="!showDescPreview"
          v-model="editItemForm.description"
          rows="4"
          class="descTextarea"
          placeholder="支持 Markdown 格式..."
        />
        <div v-else class="descPreviewBox">
          {{ editItemForm.description || '暂无描述' }}
        </div>
      </div>
      <div class="formRow">
        <div class="formGroup formGroupHalf">
          <label>优先级</label>
          <select v-model="editItemForm.priority" class="formSelect">
            <option value="high">高</option>
            <option value="medium">中</option>
            <option value="low">低</option>
          </select>
        </div>
        <div class="formGroup formGroupHalf">
          <label>截止日期</label>
          <input v-model="editItemForm.dueDate" type="date" />
        </div>
      </div>
      <div class="formGroup">
        <label>提醒时间</label>
        <input v-model="editItemForm.reminderAt" type="datetime-local" />
      </div>

      <!-- Attachments -->
      <div class="formGroup">
        <label>附件 ({{ editItemAttachments.length }})</label>
        <div v-if="editItemAttachments.length > 0" class="attachmentList">
          <div v-for="att in editItemAttachments" :key="att.id" class="attachmentRow">
            <span class="attType">{{ att.type }}</span>
            <span class="attName">{{ att.originalName || att.url || att.filePath }}</span>
            <button class="iconBtn" @click="handleRemoveItemAttachment(att.id)">&times;</button>
          </div>
        </div>
        <div class="attachmentActions">
          <input
            v-if="showUrlInput"
            v-model="newAttUrl"
            type="text"
            placeholder="输入 URL..."
            class="urlInput"
            @keydown.enter="handleAddUrlAttachment"
            @keydown.escape="showUrlInput = false"
          />
          <BaseButton v-else variant="ghost" size="sm" @click="showUrlInput = true">+ URL</BaseButton>
          <label class="fileUploadBtn">
            <BaseButton variant="ghost" size="sm" as="span">+ 文件</BaseButton>
            <input type="file" class="hiddenFileInput" @change="handleAddFileAttachment" />
          </label>
        </div>
      </div>

      <!-- Linked notes/diagrams -->
      <div class="formRow">
        <div class="formGroup formGroupHalf">
          <label>关联笔记</label>
          <select v-model="editItemForm.linkedNoteId" class="formSelect">
            <option :value="null">无</option>
            <option v-for="n in availableNotes" :key="n.id" :value="n.id">{{ n.title }}</option>
          </select>
        </div>
        <div class="formGroup formGroupHalf">
          <label>关联图表</label>
          <select v-model="editItemForm.linkedDiagramId" class="formSelect">
            <option :value="null">无</option>
            <option v-for="d in availableDiagrams" :key="d.id" :value="d.id">{{ d.title }}</option>
          </select>
        </div>
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
import type { MilestoneWithItems, ChecklistItem, ChecklistAttachment, ProgressData, Note, Diagram, Priority } from '../types';
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

// Edit item form extras
const editItemAttachments = ref<ChecklistAttachment[]>([]);
const availableNotes = ref<Note[]>([]);
const availableDiagrams = ref<Diagram[]>([]);
const showDescPreview = ref(false);
const showUrlInput = ref(false);
const newAttUrl = ref('');

const editMilestoneForm = reactive({ title: '', dueDate: '', reminderAt: '' });
const editItemForm = reactive({
  content: '',
  description: '',
  priority: 'medium' as Priority,
  dueDate: '',
  reminderAt: '',
  linkedNoteId: null as number | null,
  linkedDiagramId: null as number | null,
});

watch(() => editMilestone.value, (m) => {
  if (m) {
    editMilestoneForm.title = m.title;
    editMilestoneForm.dueDate = m.dueDate || '';
    editMilestoneForm.reminderAt = m.reminderAt ? timestampToDatetimeLocal(m.reminderAt) : '';
  }
});

watch(() => editItem.value, async (item) => {
  if (item) {
    editItemForm.content = item.content;
    editItemForm.description = item.description || '';
    editItemForm.priority = item.priority || 'medium';
    editItemForm.dueDate = item.dueDate || '';
    editItemForm.reminderAt = item.reminderAt ? timestampToDatetimeLocal(item.reminderAt) : '';
    editItemForm.linkedNoteId = item.linkedNoteId;
    editItemForm.linkedDiagramId = item.linkedDiagramId;
    showDescPreview.value = false;
    showUrlInput.value = false;
    newAttUrl.value = '';

    // Load attachments & available notes/diagrams
    const [atts, notes, diagrams] = await Promise.all([
      $fetch<ChecklistAttachment[]>(
        `/api/project-tracker/projects/${props.projectId}/checklist/${item.id}/attachments`,
      ),
      $fetch<Note[]>(`/api/project-tracker/projects/${props.projectId}/notes`),
      $fetch<Diagram[]>(`/api/project-tracker/projects/${props.projectId}/diagrams`),
    ]);
    editItemAttachments.value = atts;
    availableNotes.value = notes;
    availableDiagrams.value = diagrams;
  }
});

function timestampToDatetimeLocal(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function datetimeLocalToTimestamp(val: string): number | null {
  if (!val) return null;
  return new Date(val).getTime();
}

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
      description: editItemForm.description || null,
      priority: editItemForm.priority,
      dueDate: editItemForm.dueDate || null,
      reminderAt: datetimeLocalToTimestamp(editItemForm.reminderAt),
      linkedNoteId: editItemForm.linkedNoteId,
      linkedDiagramId: editItemForm.linkedDiagramId,
    },
  });
  editItem.value = null;
  await loadData();
}

async function handleAddUrlAttachment() {
  if (!editItem.value || !newAttUrl.value.trim()) return;
  const att = await $fetch<ChecklistAttachment>(
    `/api/project-tracker/projects/${props.projectId}/checklist/${editItem.value.id}/attachments`,
    { method: 'POST', body: { type: 'url', url: newAttUrl.value.trim() } },
  );
  editItemAttachments.value = [...editItemAttachments.value, att];
  newAttUrl.value = '';
  showUrlInput.value = false;
}

async function handleAddFileAttachment(e: Event) {
  if (!editItem.value) return;
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('file', file);
  const uploadResult = await $fetch<{ filePath: string }>(
    `/api/project-tracker/uploads/image?projectId=${props.projectId}`,
    { method: 'POST', body: formData },
  );
  const att = await $fetch<ChecklistAttachment>(
    `/api/project-tracker/projects/${props.projectId}/checklist/${editItem.value.id}/attachments`,
    { method: 'POST', body: { type: 'file', filePath: uploadResult.filePath, originalName: file.name } },
  );
  editItemAttachments.value = [...editItemAttachments.value, att];
  (e.target as HTMLInputElement).value = '';
}

async function handleRemoveItemAttachment(attachmentId: number) {
  if (!editItem.value) return;
  await $fetch(
    `/api/project-tracker/projects/${props.projectId}/checklist/${editItem.value.id}/attachments/${attachmentId}`,
    { method: 'DELETE' },
  );
  editItemAttachments.value = editItemAttachments.value.filter(a => a.id !== attachmentId);
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
      reminderAt: datetimeLocalToTimestamp(editMilestoneForm.reminderAt),
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

.formGroup input,
.formGroup select,
.formSelect {
  width: 100%;
  padding: var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
}

.formRow {
  display: flex;
  gap: var(--spacing-md);
}

.formGroupHalf {
  flex: 1;
}

.descToggle {
  display: flex;
  gap: 2px;
  margin-bottom: var(--spacing-xs);
}

.toggleBtn {
  padding: 2px 8px;
  font-size: 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
  cursor: pointer;
}

.toggleBtn.active {
  background: var(--color-accent);
  color: var(--color-accent-inverse);
  border-color: var(--color-accent);
}

.descTextarea {
  width: 100%;
  padding: var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-family: monospace;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  resize: vertical;
}

.descPreviewBox {
  padding: var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  min-height: 80px;
  white-space: pre-wrap;
  color: var(--color-text-primary);
}

.attachmentList {
  margin-bottom: var(--spacing-xs);
}

.attachmentRow {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: 2px 0;
  font-size: 13px;
}

.attType {
  font-size: 10px;
  padding: 0 4px;
  background: var(--color-bg-hover);
  border-radius: 2px;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  flex-shrink: 0;
}

.attName {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-text-secondary);
}

.attachmentActions {
  display: flex;
  gap: var(--spacing-xs);
  align-items: center;
}

.urlInput {
  flex: 1;
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
}

.fileUploadBtn {
  cursor: pointer;
}

.hiddenFileInput {
  display: none;
}

.iconBtn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 4px;
  font-size: 12px;
  opacity: 0.5;
}

.iconBtn:hover {
  opacity: 1;
}
</style>
