<template>
  <div class="projectDetailView">
    <div v-if="loading" class="loadingState">加载中...</div>

    <template v-else-if="project">
      <ProjectHeader
        :project="project"
        @back="$emit('back')"
        @edit="showEditForm = true"
        @delete="showDeleteConfirm = true"
        @update-status="handleStatusUpdate"
      />

      <!-- Split layout: left checklist (30%), right notes+diagrams (70%) -->
      <div class="splitLayout">
        <div class="leftPane">
          <h3 class="paneTitle">Checklist</h3>
          <ChecklistTab :project-id="projectId" />
        </div>
        <div class="rightPane">
          <NotesAndDiagramsPane :project-id="projectId" />
        </div>
      </div>

      <!-- AI Chat toggle button -->
      <button class="chatToggle" @click="showChat = !showChat">
        AI 对话
      </button>

      <!-- AI Chat panel -->
      <AiChatPanel
        :project-id="projectId"
        :open="showChat"
        @close="showChat = false"
      />
    </template>

    <!-- Edit form -->
    <BaseModal :open="showEditForm" title="编辑事项" @close="showEditForm = false">
      <form v-if="project" @submit.prevent="handleEdit">
        <div class="formGroup">
          <label>标题</label>
          <input v-model="editForm.title" type="text" required />
        </div>
        <div class="formGroup">
          <label>分类</label>
          <select v-model="editForm.categoryId">
            <option v-for="cat in store.categories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
          </select>
        </div>
        <div class="formRow">
          <div class="formGroup">
            <label>优先级</label>
            <select v-model="editForm.priority">
              <option value="low">低</option>
              <option value="medium">中</option>
              <option value="high">高</option>
            </select>
          </div>
          <div class="formGroup">
            <label>截止日期</label>
            <input v-model="editForm.dueDate" type="date" />
          </div>
        </div>
        <div class="formGroup">
          <label>描述</label>
          <textarea v-model="editForm.description" rows="3" />
        </div>
        <div class="formGroup">
          <label>提醒时间</label>
          <input v-model="editForm.reminderAt" type="datetime-local" />
        </div>
        <div v-if="project.status === 'blocked'" class="formGroup">
          <label>受阻原因</label>
          <input v-model="editForm.blockedReason" type="text" />
        </div>
      </form>
      <template #footer>
        <BaseButton variant="ghost" @click="showEditForm = false">取消</BaseButton>
        <BaseButton @click="handleEdit">保存</BaseButton>
      </template>
    </BaseModal>

    <!-- Delete confirm -->
    <ConfirmDialog
      :open="showDeleteConfirm"
      title="删除事项"
      message="确定要删除这个事项吗？所有相关数据（任务、笔记、图表、对话）将一并删除。"
      @confirm="handleDelete"
      @cancel="showDeleteConfirm = false"
    />
  </div>
</template>

<script setup lang="ts">
import type { ProjectWithDetails, ProjectStatus } from '../types';
import ProjectHeader from './ProjectHeader.vue';
import ChecklistTab from './ChecklistTab.vue';
import NotesAndDiagramsPane from './NotesAndDiagramsPane.vue';
import AiChatPanel from './AiChatPanel.vue';

const props = defineProps<{
  projectId: number;
}>();

const emit = defineEmits<{
  back: [];
}>();

const store = useProjectTrackerStore();

const loading = ref(true);
const project = ref<ProjectWithDetails | null>(null);
const showEditForm = ref(false);
const showDeleteConfirm = ref(false);
const showChat = ref(false);

const editForm = reactive({
  title: '',
  description: '',
  categoryId: 0,
  priority: 'medium' as string,
  dueDate: '',
  reminderAt: '',
  blockedReason: '',
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

async function loadProject() {
  project.value = await $fetch<ProjectWithDetails>(`/api/project-tracker/projects/${props.projectId}`);
}

onMounted(async () => {
  try {
    await loadProject();
  } finally {
    loading.value = false;
  }
});

watch(() => showEditForm.value, (isOpen) => {
  if (isOpen && project.value) {
    editForm.title = project.value.title;
    editForm.description = project.value.description || '';
    editForm.categoryId = project.value.categoryId;
    editForm.priority = project.value.priority;
    editForm.dueDate = project.value.dueDate || '';
    editForm.reminderAt = project.value.reminderAt ? timestampToDatetimeLocal(project.value.reminderAt) : '';
    editForm.blockedReason = project.value.blockedReason || '';
  }
});

async function handleStatusUpdate(status: ProjectStatus) {
  await store.updateProject(props.projectId, { status });
  await loadProject();
}

async function handleEdit() {
  await store.updateProject(props.projectId, {
    title: editForm.title,
    description: editForm.description || undefined,
    categoryId: editForm.categoryId,
    priority: editForm.priority as any,
    dueDate: editForm.dueDate || null,
    reminderAt: datetimeLocalToTimestamp(editForm.reminderAt),
    blockedReason: editForm.blockedReason || null,
  });
  showEditForm.value = false;
  await loadProject();
}

async function handleDelete() {
  await store.deleteProject(props.projectId);
  showDeleteConfirm.value = false;
  emit('back');
}
</script>

<style scoped>
.projectDetailView {
  padding: var(--spacing-md);
}

.loadingState {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--color-text-secondary);
}

.paneTitle {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-sm);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.splitLayout {
  display: flex;
  gap: var(--spacing-md);
  height: calc(100vh - 200px);
  min-height: 400px;
}

.leftPane {
  flex: 0 0 30%;
  min-width: 0;
  border-right: 1px solid var(--color-border);
  padding-right: var(--spacing-md);
  overflow-y: auto;
}

.rightPane {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
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
.formGroup textarea {
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

.formRow .formGroup {
  flex: 1;
}

.chatToggle {
  position: fixed;
  bottom: var(--spacing-lg);
  right: var(--spacing-lg);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-accent);
  color: var(--color-accent-inverse);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  z-index: 50;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.chatToggle:hover {
  opacity: 0.9;
}

@media (max-width: 768px) {
  .projectDetailView {
    padding: var(--spacing-sm);
  }

  .splitLayout {
    flex-direction: column;
    height: auto;
  }

  .leftPane {
    flex: none;
    border-right: none;
    padding-right: 0;
    border-bottom: 1px solid var(--color-border);
    padding-bottom: var(--spacing-md);
  }

  .chatToggle {
    bottom: calc(var(--bottom-nav-height) + var(--spacing-md));
  }
}
</style>
