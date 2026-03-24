import { defineStore } from 'pinia';
import type {
  ProjectTrackerView,
  ProjectWithDetails,
  Category,
  Tag,
  ProjectFilters,
  CreateProjectData,
  UpdateProjectData,
} from '~/tools/project-tracker/types';

export const useProjectTrackerStore = defineStore('project-tracker', () => {
  // ===== State =====
  const currentView = ref<ProjectTrackerView>({ type: 'list' });
  const projects = ref<ProjectWithDetails[]>([]);
  const categories = ref<Category[]>([]);
  const tags = ref<Tag[]>([]);
  const loading = ref(false);

  const displayMode = ref<'list' | 'kanban'>('list');

  const filters = ref<ProjectFilters>({
    statuses: [],
    categoryId: null,
    tagIds: [],
    search: '',
    showArchived: false,
  });

  // ===== Navigation =====
  function navigateTo(view: ProjectTrackerView) {
    currentView.value = view;
  }

  // ===== Categories =====
  async function loadCategories() {
    categories.value = await $fetch<Category[]>('/api/project-tracker/categories');
  }

  async function createCategory(name: string) {
    await $fetch('/api/project-tracker/categories', { method: 'POST', body: { name } });
    await loadCategories();
  }

  async function updateCategory(id: number, name: string) {
    await $fetch(`/api/project-tracker/categories/${id}`, { method: 'PUT', body: { name } });
    await loadCategories();
  }

  async function deleteCategory(id: number) {
    await $fetch(`/api/project-tracker/categories/${id}`, { method: 'DELETE' });
    await loadCategories();
  }

  async function reorderCategories(items: { id: number; sortOrder: number }[]) {
    await $fetch('/api/project-tracker/categories/reorder', { method: 'PUT', body: { items } });
    await loadCategories();
  }

  // ===== Tags =====
  async function loadTags() {
    tags.value = await $fetch<Tag[]>('/api/project-tracker/tags');
  }

  async function createTag(name: string) {
    await $fetch('/api/project-tracker/tags', { method: 'POST', body: { name } });
    await loadTags();
  }

  async function deleteTag(id: number) {
    await $fetch(`/api/project-tracker/tags/${id}`, { method: 'DELETE' });
    await loadTags();
  }

  // ===== Projects =====
  async function loadProjects() {
    const params: Record<string, string> = {};
    const f = filters.value;
    if (f.statuses.length) params.status = f.statuses.join(',');
    if (f.categoryId) params.categoryId = String(f.categoryId);
    if (f.tagIds.length) params.tagIds = f.tagIds.join(',');
    if (f.search) params.search = f.search;
    if (f.showArchived) params.archived = 'true';

    projects.value = await $fetch<ProjectWithDetails[]>('/api/project-tracker/projects', { params });
  }

  async function createProject(data: CreateProjectData) {
    await $fetch('/api/project-tracker/projects', { method: 'POST', body: data });
    await loadProjects();
  }

  async function updateProject(id: number, data: UpdateProjectData) {
    await $fetch(`/api/project-tracker/projects/${id}`, { method: 'PUT', body: data });
    await loadProjects();
  }

  async function deleteProject(id: number) {
    await $fetch(`/api/project-tracker/projects/${id}`, { method: 'DELETE' });
    await loadProjects();
  }

  async function updateProjectTags(id: number, tagIds: number[]) {
    await $fetch(`/api/project-tracker/projects/${id}/tags`, { method: 'PUT', body: { tagIds } });
    await loadProjects();
  }

  async function archiveProject(id: number, archive: boolean) {
    await $fetch(`/api/project-tracker/projects/${id}/archive`, { method: 'POST', body: { archive } });
    await loadProjects();
  }

  // ===== Init =====
  async function init() {
    loading.value = true;
    try {
      await Promise.all([loadCategories(), loadTags(), loadProjects()]);
    } finally {
      loading.value = false;
    }
  }

  return {
    // State
    currentView,
    projects,
    categories,
    tags,
    loading,
    filters,
    displayMode,
    // Navigation
    navigateTo,
    // Categories
    loadCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
    // Tags
    loadTags,
    createTag,
    deleteTag,
    // Projects
    loadProjects,
    createProject,
    updateProject,
    deleteProject,
    updateProjectTags,
    archiveProject,
    // Init
    init,
  };
});
