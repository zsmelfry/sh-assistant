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

      <TabNav v-model="activeTab" :tabs="tabs" />

      <!-- Tab content -->
      <div class="tabContent">
        <ChecklistTab
          v-if="activeTab === 'checklist'"
          :project-id="projectId"
        />
        <NotesTab
          v-else-if="activeTab === 'notes'"
          :project-id="projectId"
        />
        <DiagramTab
          v-else-if="activeTab === 'diagrams'"
          :project-id="projectId"
        />
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
import TabNav from './TabNav.vue';
import ChecklistTab from './ChecklistTab.vue';
import NotesTab from './NotesTab.vue';
import DiagramTab from './DiagramTab.vue';
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
const activeTab = ref('checklist');
const showEditForm = ref(false);
const showDeleteConfirm = ref(false);
const showChat = ref(false);

const editForm = reactive({
  title: '',
  description: '',
  categoryId: 0,
  priority: 'medium' as string,
  dueDate: '',
  blockedReason: '',
});

const tabs = computed(() => [
  { id: 'checklist', label: 'Checklist', count: project.value?.checklistTotal },
  { id: 'notes', label: '笔记', count: project.value?.noteCount },
  { id: 'diagrams', label: 'Diagram', count: project.value?.diagramCount },
]);

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
  padding: var(--spacing-lg);
  max-width: 900px;
  margin: 0 auto;
}

.loadingState {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--color-text-secondary);
}

.tabContent {
  min-height: 200px;
}

.tabPlaceholder {
  text-align: center;
  padding: var(--spacing-xl);
  color: var(--color-text-secondary);
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
    padding: var(--spacing-md);
  }

  .chatToggle {
    bottom: calc(var(--bottom-nav-height) + var(--spacing-md));
  }
}
</style>
