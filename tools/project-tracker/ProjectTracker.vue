<template>
  <div class="projectTracker">
    <div v-if="loading" class="loadingState">加载中...</div>

    <template v-else>
      <!-- List View -->
      <ProjectListView
        v-if="store.currentView.type === 'list'"
        :projects="store.projects"
        :categories="store.categories"
        :tags="store.tags"
        :filters="store.filters"
        @open-project="store.navigateTo({ type: 'detail', projectId: $event })"
        @create-project="showProjectForm = true"
        @manage-categories="showCategoryManager = true"
        @update-filters="handleUpdateFilters"
        @update-status="handleQuickStatusUpdate"
      />

      <!-- Detail View -->
      <ProjectDetailView
        v-else-if="store.currentView.type === 'detail'"
        :project-id="store.currentView.projectId"
        @back="store.navigateTo({ type: 'list' })"
      />
    </template>

    <!-- Modals -->
    <ProjectForm
      :open="showProjectForm"
      :categories="store.categories"
      :tags="store.tags"
      @close="showProjectForm = false"
      @submit="handleCreateProject"
    />

    <CategoryManager
      :open="showCategoryManager"
      :categories="store.categories"
      @close="showCategoryManager = false"
      @create="store.createCategory($event)"
      @update="store.updateCategory($event.id, $event.name)"
      @delete="store.deleteCategory($event)"
      @reorder="store.reorderCategories($event)"
    />
  </div>
</template>

<script setup lang="ts">
import type { ProjectFilters, ProjectStatus, CreateProjectData } from './types';
import ProjectListView from './components/ProjectListView.vue';
import ProjectDetailView from './components/ProjectDetailView.vue';
import ProjectForm from './components/ProjectForm.vue';
import CategoryManager from './components/CategoryManager.vue';

const store = useProjectTrackerStore();

const loading = ref(true);
const showProjectForm = ref(false);
const showCategoryManager = ref(false);

onMounted(async () => {
  try {
    await store.init();
  } finally {
    loading.value = false;
  }
});

function handleUpdateFilters(newFilters: Partial<ProjectFilters>) {
  Object.assign(store.filters, newFilters);
  store.loadProjects();
}

async function handleQuickStatusUpdate(projectId: number, status: ProjectStatus) {
  await store.updateProject(projectId, { status });
}

async function handleCreateProject(data: CreateProjectData) {
  await store.createProject(data);
  showProjectForm.value = false;
}
</script>

<style scoped>
.projectTracker {
  height: 100%;
  overflow-y: auto;
}

.loadingState {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--color-text-secondary);
}
</style>
