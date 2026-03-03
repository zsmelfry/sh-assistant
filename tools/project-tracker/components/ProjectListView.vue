<template>
  <div class="projectListView" :class="{ kanbanMode: store.displayMode === 'kanban' }">
    <div class="listHeader">
      <h2>事项追踪</h2>
      <div class="viewToggle">
        <button
          class="toggleBtn"
          :class="{ active: store.displayMode === 'list' }"
          title="列表视图"
          @click="store.displayMode = 'list'"
        >
          ☰
        </button>
        <button
          class="toggleBtn"
          :class="{ active: store.displayMode === 'kanban' }"
          title="看板视图"
          @click="store.displayMode = 'kanban'"
        >
          ⊞
        </button>
      </div>
      <div class="headerActions">
        <BaseButton @click="$emit('create-project')">+ 新事项</BaseButton>
        <BaseButton variant="ghost" @click="$emit('manage-categories')">管理分类</BaseButton>
      </div>
    </div>

    <ProjectFilters
      :filters="filters"
      :categories="categories"
      :tags="tags"
      @update="$emit('update-filters', $event)"
    />

    <!-- Empty state -->
    <div v-if="projects.length === 0" class="emptyState">
      <p>还没有事项</p>
      <BaseButton @click="$emit('create-project')">创建第一个事项</BaseButton>
    </div>

    <!-- Grouped project list -->
    <template v-else>
      <!-- Kanban mode -->
      <KanbanBoard
        v-if="store.displayMode === 'kanban'"
        :projects="nonIdeaProjects"
        :categories="categories"
        :tags="tags"
        @open-project="$emit('open-project', $event)"
      />

      <!-- List mode: Active projects grouped by category -->
      <template v-else>
        <div v-for="group in groupedProjects" :key="group.categoryId" class="categoryGroup">
          <h3 class="groupTitle">{{ group.categoryName }}</h3>
          <div class="projectList">
            <ProjectCard
              v-for="p in group.projects"
              :key="p.id"
              :project="p"
              @click="$emit('open-project', p.id)"
              @update-status="$emit('update-status', p.id, $event)"
            />
          </div>
        </div>
      </template>

      <!-- Idea pool (always visible) -->
      <div v-if="ideaProjects.length > 0" class="categoryGroup ideaPool">
        <h3 class="groupTitle">灵感池</h3>
        <div class="projectList">
          <ProjectCard
            v-for="p in ideaProjects"
            :key="p.id"
            :project="p"
            @click="$emit('open-project', p.id)"
            @update-status="$emit('update-status', p.id, $event)"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { ProjectWithDetails, Category, Tag, ProjectFilters, ProjectStatus } from '../types';
import { STATUS_ORDER } from '../types';
import ProjectCard from './ProjectCard.vue';
import ProjectFiltersComp from './ProjectFilters.vue';
import KanbanBoard from './KanbanBoard.vue';

// Rename to avoid collision with prop name
const ProjectFilters = ProjectFiltersComp;

const store = useProjectTrackerStore();

const props = defineProps<{
  projects: ProjectWithDetails[];
  categories: Category[];
  tags: Tag[];
  filters: ProjectFilters;
}>();

defineEmits<{
  'open-project': [id: number];
  'create-project': [];
  'manage-categories': [];
  'update-filters': [filters: Partial<ProjectFilters>];
  'update-status': [projectId: number, status: ProjectStatus];
}>();

// Separate idea projects from active ones
const ideaProjects = computed(() =>
  props.projects
    .filter(p => p.status === 'idea')
    .sort((a, b) => a.sortOrder - b.sortOrder),
);

// Non-idea projects (used by kanban board)
const nonIdeaProjects = computed(() =>
  props.projects.filter(p => p.status !== 'idea'),
);

// Group non-idea projects by category, sorted by status priority
const groupedProjects = computed(() => {
  const active = props.projects.filter(p => p.status !== 'idea');

  const groups = new Map<number, { categoryId: number; categoryName: string; projects: ProjectWithDetails[] }>();

  for (const p of active) {
    if (!groups.has(p.categoryId)) {
      groups.set(p.categoryId, {
        categoryId: p.categoryId,
        categoryName: p.categoryName || '未分类',
        projects: [],
      });
    }
    groups.get(p.categoryId)!.projects.push(p);
  }

  // Sort projects within each group by status priority then due date
  for (const group of groups.values()) {
    group.projects.sort((a, b) => {
      const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (statusDiff !== 0) return statusDiff;
      // Due date: items with due date first, earlier date first
      if (a.dueDate && !b.dueDate) return -1;
      if (!a.dueDate && b.dueDate) return 1;
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      return a.sortOrder - b.sortOrder;
    });
  }

  // Sort groups by category sort order
  const catOrder = new Map(props.categories.map(c => [c.id, c.sortOrder]));
  return [...groups.values()].sort((a, b) =>
    (catOrder.get(a.categoryId) ?? 999) - (catOrder.get(b.categoryId) ?? 999),
  );
});
</script>

<style scoped>
.projectListView {
  padding: var(--spacing-lg);
  max-width: 900px;
  margin: 0 auto;
}

.projectListView.kanbanMode {
  max-width: 1200px;
}

.listHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-lg);
}

.listHeader h2 {
  font-size: 20px;
  font-weight: 700;
}

.viewToggle {
  display: flex;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.toggleBtn {
  padding: 4px 8px;
  border: none;
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.toggleBtn:not(:last-child) {
  border-right: 1px solid var(--color-border);
}

.toggleBtn:hover {
  background: var(--color-bg-hover);
}

.toggleBtn.active {
  background: var(--color-accent);
  color: var(--color-bg-primary);
}

.headerActions {
  display: flex;
  gap: var(--spacing-sm);
}

.emptyState {
  text-align: center;
  padding: var(--spacing-xl) 0;
  color: var(--color-text-secondary);
}

.emptyState p {
  margin-bottom: var(--spacing-md);
}

.categoryGroup {
  margin-bottom: var(--spacing-lg);
}

.groupTitle {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding-bottom: var(--spacing-xs);
  border-bottom: 1px solid var(--color-border);
  margin-bottom: var(--spacing-sm);
}

.ideaPool .groupTitle {
  border-bottom-style: dashed;
}

.projectList {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

@media (max-width: 768px) {
  .projectListView {
    padding: var(--spacing-md);
  }

  .listHeader {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-sm);
  }
}
</style>
