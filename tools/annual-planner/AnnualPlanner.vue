<template>
  <div class="annualPlanner">
    <!-- Empty state: first use -->
    <EmptyState
      v-if="!loading && domains.length === 0"
      title="开始规划你的年度目标"
      hint="创建领域来组织你的目标，如事业、健康、兴趣"
      action-label="开始规划"
      @action="handleInitialize"
    />

    <template v-else-if="domains.length > 0">
      <!-- Navigation bar (show on overview and tags views) -->
      <ViewNav
        v-if="store.currentView.type !== 'domain'"
        :current-type="store.currentView.type"
        @navigate="store.navigateTo($event)"
      />

      <!-- Overview page -->
      <OverviewPage
        v-if="store.currentView.type === 'overview'"
        :domains="domains"
        :stats="store.overviewStats"
        :domain-goal-stats="store.domainGoalStats"
        @select-domain="store.navigateTo({ type: 'domain', domainId: $event })"
        @create-domain="showDomainForm = true"
        @edit-domain="openEditDomain"
        @delete-domain="openDeleteDomain"
        @reorder-domains="store.reorderDomains($event)"
      />

      <!-- Domain detail page -->
      <DomainDetailPage
        v-else-if="store.currentView.type === 'domain' && store.currentDomain"
        :domain="store.currentDomain"
        :goals="store.goals"
        @back="store.navigateTo({ type: 'overview' })"
        @create-goal="openNewGoalForm"
        @edit-goal="openEditGoal"
        @delete-goal="openDeleteGoal"
        @reorder-goals="store.reorderGoals($event)"
        @toggle-checkitem="store.toggleCheckitem($event)"
        @delete-checkitem="store.deleteCheckitem($event)"
        @add-checkitem="store.createCheckitem"
        @update-checkitem="store.updateCheckitem"
        @reorder-checkitems="store.reorderCheckitems($event)"
      />

      <!-- Tags page -->
      <TagsPage
        v-else-if="store.currentView.type === 'tags'"
        :tag-stats="store.tagStats"
        @manage-tags="showTagManager = true"
      />
    </template>

    <!-- Domain form -->
    <DomainForm
      :open="showDomainForm"
      :edit-domain="editingDomain"
      @close="closeDomainForm"
      @submit="handleDomainSubmit"
    />

    <!-- Goal form -->
    <GoalForm
      :open="showGoalForm"
      :edit-goal="editingGoal"
      :available-tags="store.tags"
      @close="closeGoalForm"
      @submit="handleGoalSubmit"
    />

    <!-- Tag manager -->
    <TagManager
      :open="showTagManager"
      :tags="store.tags"
      @close="showTagManager = false"
      @create="store.createTag"
      @update="store.updateTag"
      @delete="handleDeleteTag"
    />

    <!-- Delete domain confirm -->
    <ConfirmDialog
      :open="!!deletingDomain"
      title="删除领域"
      :message="deleteDomainMessage"
      confirm-text="删除"
      :danger="true"
      @confirm="handleDeleteDomain"
      @cancel="deletingDomain = null"
    />

    <!-- Delete goal confirm -->
    <ConfirmDialog
      :open="!!deletingGoal"
      title="删除目标"
      :message="deleteGoalMessage"
      confirm-text="删除"
      :danger="true"
      @confirm="handleDeleteGoal"
      @cancel="deletingGoal = null"
    />

    <!-- Delete tag confirm -->
    <ConfirmDialog
      :open="!!deletingTag"
      title="删除标签"
      :message="deleteTagMessage"
      confirm-text="删除"
      :danger="true"
      @confirm="handleDeleteTagConfirm"
      @cancel="deletingTag = null"
    />
  </div>
</template>

<script setup lang="ts">
import type { DomainWithStats, GoalWithDetails, PlannerTag, Priority } from './types';

import EmptyState from './components/EmptyState.vue';
import ViewNav from './components/ViewNav.vue';
import OverviewPage from './components/OverviewPage.vue';
import DomainDetailPage from './components/DomainDetailPage.vue';
import TagsPage from './components/TagsPage.vue';
import DomainForm from './components/DomainForm.vue';
import GoalForm from './components/GoalForm.vue';
import TagManager from './components/TagManager.vue';

const store = usePlannerStore();
const domains = computed(() => store.domains);
const loading = ref(true);

// Domain form state
const showDomainForm = ref(false);
const editingDomain = ref<DomainWithStats | null>(null);

// Goal form state
const showGoalForm = ref(false);
const editingGoal = ref<GoalWithDetails | null>(null);

// Tag manager state
const showTagManager = ref(false);

// Delete confirm state
const deletingDomain = ref<DomainWithStats | null>(null);
const deletingGoal = ref<GoalWithDetails | null>(null);
const deletingTag = ref<PlannerTag | null>(null);

// Computed delete messages
const deleteDomainMessage = computed(() => {
  if (!deletingDomain.value) return '';
  return `确认删除领域「${deletingDomain.value.name}」？该领域下的 ${deletingDomain.value.goalCount} 个目标将一并删除。`;
});

const deleteGoalMessage = computed(() => {
  if (!deletingGoal.value) return '';
  return `确认删除目标「${deletingGoal.value.title}」？其下 ${deletingGoal.value.totalCheckitems} 个检查项将一并删除。`;
});

const deleteTagMessage = computed(() => {
  if (!deletingTag.value) return '';
  return `确认删除标签「${deletingTag.value.name}」？仅解除与目标的关联，不影响目标本身。`;
});

// Initialize
onMounted(async () => {
  try {
    await store.loadDomains();
    await store.loadTags();
    if (store.domains.length > 0) {
      await store.loadOverview();
      await store.loadDomainGoalStats();
    }
  } finally {
    loading.value = false;
  }
});

// First-time setup
async function handleInitialize() {
  loading.value = true;
  try {
    await store.initializeDefaults();
  } finally {
    loading.value = false;
  }
}

// Domain form handlers
function openEditDomain(domain: DomainWithStats) {
  editingDomain.value = domain;
  showDomainForm.value = true;
}

function closeDomainForm() {
  showDomainForm.value = false;
  editingDomain.value = null;
}

async function handleDomainSubmit(name: string) {
  if (editingDomain.value) {
    await store.updateDomain(editingDomain.value.id, name);
  } else {
    await store.createDomain(name);
  }
  await store.loadOverview();
  closeDomainForm();
}

// Delete domain
function openDeleteDomain(domain: DomainWithStats) {
  deletingDomain.value = domain;
}

async function handleDeleteDomain() {
  if (!deletingDomain.value) return;
  await store.deleteDomain(deletingDomain.value.id);
  await store.loadOverview();
  deletingDomain.value = null;
}

// Goal form handlers
function openNewGoalForm() {
  editingGoal.value = null;
  showGoalForm.value = true;
}

function openEditGoal(goal: GoalWithDetails) {
  editingGoal.value = goal;
  showGoalForm.value = true;
}

function closeGoalForm() {
  showGoalForm.value = false;
  editingGoal.value = null;
}

async function handleGoalSubmit(data: { title: string; description: string; priority: Priority; tagIds: number[] }) {
  if (editingGoal.value) {
    await store.updateGoal(editingGoal.value.id, data);
  } else if (store.currentView.type === 'domain') {
    await store.createGoal({
      domainId: store.currentView.domainId,
      ...data,
    });
  }
  closeGoalForm();
}

// Delete goal
function openDeleteGoal(goal: GoalWithDetails) {
  deletingGoal.value = goal;
}

async function handleDeleteGoal() {
  if (!deletingGoal.value) return;
  await store.deleteGoal(deletingGoal.value.id);
  deletingGoal.value = null;
}

// Tag handlers
function handleDeleteTag(id: number) {
  const tag = store.tags.find(t => t.id === id);
  if (tag) {
    deletingTag.value = tag;
  }
}

async function handleDeleteTagConfirm() {
  if (!deletingTag.value) return;
  await store.deleteTag(deletingTag.value.id);
  deletingTag.value = null;
}
</script>

<style scoped>
.annualPlanner {
  height: 100%;
  overflow-y: auto;
}
</style>
