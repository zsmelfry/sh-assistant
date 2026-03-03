<template>
  <div class="diagramTab">
    <!-- List view -->
    <template v-if="!editingDiagram">
      <div class="diagramHeader">
        <BaseButton size="sm" @click="handleCreate">+ 新图表</BaseButton>
      </div>

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
    </template>

    <!-- Editor view -->
    <DiagramEditor
      v-else
      :diagram="editingDiagram"
      :project-id="projectId"
      @back="editingDiagram = null"
      @save="handleSave"
    />
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
  padding: var(--spacing-sm) 0;
}

.diagramHeader {
  margin-bottom: var(--spacing-md);
}

.emptyDiagrams {
  text-align: center;
  padding: var(--spacing-xl);
  color: var(--color-text-secondary);
}

.diagramList {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}
</style>
