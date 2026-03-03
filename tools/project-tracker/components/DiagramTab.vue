<template>
  <div class="diagramTab">
    <!-- List view -->
    <template v-if="!editingDiagram">
      <div class="paneHeader">
        <h3 class="paneTitle">Diagram</h3>
        <BaseButton size="sm" @click="handleCreate">+ 新图表</BaseButton>
      </div>

      <div class="paneBody">
        <div v-if="diagrams.length === 0" class="emptyDiagrams">
          还没有图表
        </div>

        <div v-else class="diagramList">
          <DiagramCard
            v-for="d in diagrams"
            :key="d.id"
            :diagram="d"
            @click="openDiagram(d)"
            @delete="handleDelete(d.id)"
          />
        </div>
      </div>
    </template>

    <!-- Editor view -->
    <template v-else>
      <div class="paneHeader">
        <h3 class="paneTitle">Diagram</h3>
        <BaseButton variant="ghost" size="sm" @click="editingDiagram = null">← 返回</BaseButton>
      </div>
      <div class="paneBody">
        <DiagramEditor
          :diagram="editingDiagram"
          :project-id="projectId"
          @save="handleSave"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Diagram } from '../types';
import DiagramCard from './DiagramCard.vue';
import DiagramEditor from './DiagramEditor.vue';

const props = defineProps<{
  projectId: number;
}>();

const diagrams = ref<Diagram[]>([]);
const editingDiagram = ref<Diagram | null>(null);

async function loadDiagrams() {
  diagrams.value = await $fetch<Diagram[]>(`/api/project-tracker/projects/${props.projectId}/diagrams`);
}

onMounted(loadDiagrams);

async function handleCreate() {
  const diagram = await $fetch<Diagram>(`/api/project-tracker/projects/${props.projectId}/diagrams`, {
    method: 'POST',
    body: { title: '新图表' },
  });
  await loadDiagrams();
  openDiagram(diagram);
}

function openDiagram(diagram: Diagram) {
  editingDiagram.value = diagram;
}

async function handleSave(data: { title: string; mermaidCode: string; type: string }) {
  if (!editingDiagram.value) return;
  const updated = await $fetch<Diagram>(
    `/api/project-tracker/projects/${props.projectId}/diagrams/${editingDiagram.value.id}`,
    { method: 'PUT', body: data },
  );
  editingDiagram.value = updated;
  await loadDiagrams();
}

async function handleDelete(diagramId: number) {
  await $fetch(`/api/project-tracker/projects/${props.projectId}/diagrams/${diagramId}`, { method: 'DELETE' });
  await loadDiagrams();
}
</script>

<style scoped>
.diagramTab {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.paneHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: var(--spacing-xs);
  flex-shrink: 0;
}

.paneTitle {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.paneBody {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.emptyDiagrams {
  text-align: center;
  padding: var(--spacing-md);
  color: var(--color-text-secondary);
  font-size: 13px;
}

.diagramList {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}
</style>
