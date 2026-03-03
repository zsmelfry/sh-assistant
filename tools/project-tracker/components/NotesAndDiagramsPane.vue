<template>
  <div class="ndPane">
    <div class="paneHeader">
      <h3 class="paneTitle">笔记 & 图表</h3>
      <div class="paneActions">
        <BaseButton size="sm" @click="handleCreateNote">+ 新笔记</BaseButton>
        <BaseButton size="sm" @click="handleCreateDiagram">+ 新图表</BaseButton>
      </div>
    </div>

    <div class="paneBody">
      <div v-if="items.length === 0" class="emptyState">还没有笔记或图表</div>

      <div v-else class="itemList">
        <div
          v-for="item in items"
          :key="item.kind + '-' + item.id"
          class="itemCard"
          @click="handleOpen(item)"
        >
          <div class="cardTop">
            <span class="kindBadge" :class="item.kind">{{ item.kind === 'note' ? '笔记' : '图表' }}</span>
            <h4 class="itemTitle">{{ item.title }}</h4>
            <div class="cardActions" @click.stop>
              <button class="iconBtn" @click="handleDelete(item)">&times;</button>
            </div>
          </div>
          <p v-if="item.preview" class="itemPreview">{{ item.preview }}</p>
          <div class="cardMeta">
            <span v-if="item.kind === 'diagram' && item.diagramType" class="typeBadge">{{ item.diagramType }}</span>
            <span>{{ formatDate(item.updatedAt) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Note edit modal -->
    <BaseModal :open="!!editingNote" title="编辑笔记" max-width="900px" @close="closeNoteModal">
      <template v-if="editingNote">
        <NoteEditor
          :note="editingNote"
          :title="editTitle"
          :content="editContent"
          :attachments="editAttachments"
          :summarizing="summarizing"
          @save="handleSaveNote"
          @update:title="editTitle = $event"
          @update:content="editContent = $event"
          @add-url-attachment="handleAddUrlAttachment"
          @add-image-attachment="handleAddImageAttachment"
          @remove-attachment="handleRemoveAttachment"
        />
      </template>
      <template #footer>
        <BaseButton variant="ghost" size="sm" :disabled="summarizing" @click="handleSummarize">
          {{ summarizing ? '生成中...' : 'AI 摘要' }}
        </BaseButton>
        <BaseButton @click="handleSaveNote(); closeNoteModal()">保存并关闭</BaseButton>
      </template>
    </BaseModal>

    <!-- Diagram edit modal -->
    <BaseModal :open="!!editingDiagram" title="编辑图表" max-width="1100px" @close="closeDiagramModal">
      <template v-if="editingDiagram">
        <DiagramEditor
          :diagram="editingDiagram"
          :project-id="projectId"
          @save="handleSaveDiagram"
        />
      </template>
    </BaseModal>

    <!-- Delete confirm dialog -->
    <ConfirmDialog
      :open="!!deletingItem"
      title="删除确认"
      message="确定要删除这个笔记/图表吗？"
      @confirm="confirmDelete"
      @cancel="deletingItem = null"
    />
  </div>
</template>

<script setup lang="ts">
import type { Note, NoteWithAttachments, Attachment, Diagram } from '../types';
import NoteEditor from './NoteEditor.vue';
import DiagramEditor from './DiagramEditor.vue';

interface MixedItem {
  kind: 'note' | 'diagram';
  id: number;
  title: string;
  preview: string;
  updatedAt: number;
  diagramType?: string;
}

const props = defineProps<{
  projectId: number;
}>();

const notes = ref<Note[]>([]);
const diagrams = ref<Diagram[]>([]);

// Note editing state
const editingNote = ref<Note | null>(null);
const editTitle = ref('');
const editContent = ref('');
const editAttachments = ref<Attachment[]>([]);
const summarizing = ref(false);

// Diagram editing state
const editingDiagram = ref<Diagram | null>(null);

// Delete confirmation state
const deletingItem = ref<MixedItem | null>(null);

const items = computed<MixedItem[]>(() => {
  const list: MixedItem[] = [];
  for (const n of notes.value) {
    list.push({
      kind: 'note',
      id: n.id,
      title: n.title,
      preview: n.aiSummary || (n.content ? n.content.slice(0, 120) + (n.content.length > 120 ? '...' : '') : ''),
      updatedAt: n.updatedAt,
    });
  }
  for (const d of diagrams.value) {
    list.push({
      kind: 'diagram',
      id: d.id,
      title: d.title,
      preview: d.description || '',
      updatedAt: d.updatedAt,
      diagramType: d.type,
    });
  }
  list.sort((a, b) => b.updatedAt - a.updatedAt);
  return list;
});

async function loadNotes() {
  notes.value = await $fetch<Note[]>(`/api/project-tracker/projects/${props.projectId}/notes`);
}

async function loadDiagrams() {
  diagrams.value = await $fetch<Diagram[]>(`/api/project-tracker/projects/${props.projectId}/diagrams`);
}

async function loadAll() {
  await Promise.all([loadNotes(), loadDiagrams()]);
}

onMounted(loadAll);

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('zh-CN');
}

// === Create ===

async function handleCreateNote() {
  const existing = notes.value.find(n => n.title === '新笔记' && (!n.content || n.content === ''));
  if (existing) {
    openNote(existing);
    return;
  }
  const note = await $fetch<Note>(`/api/project-tracker/projects/${props.projectId}/notes`, {
    method: 'POST',
    body: { title: '新笔记' },
  });
  await loadNotes();
  openNote(note);
}

async function handleCreateDiagram() {
  const defaultMermaid = 'graph TD\n  A[开始] --> B[结束]';
  const existing = diagrams.value.find(d => d.title === '新图表' && d.mermaidCode === defaultMermaid);
  if (existing) {
    openDiagram(existing);
    return;
  }
  const diagram = await $fetch<Diagram>(`/api/project-tracker/projects/${props.projectId}/diagrams`, {
    method: 'POST',
    body: { title: '新图表' },
  });
  await loadDiagrams();
  openDiagram(diagram);
}

// === Open ===

function handleOpen(item: MixedItem) {
  if (item.kind === 'note') {
    const note = notes.value.find(n => n.id === item.id);
    if (note) openNote(note);
  } else {
    const diagram = diagrams.value.find(d => d.id === item.id);
    if (diagram) openDiagram(diagram);
  }
}

async function openNote(note: Note) {
  const detail = await $fetch<NoteWithAttachments>(
    `/api/project-tracker/projects/${props.projectId}/notes/${note.id}`,
  );
  editingNote.value = detail;
  editTitle.value = detail.title;
  editContent.value = detail.content || '';
  editAttachments.value = detail.attachments;
}

function openDiagram(diagram: Diagram) {
  editingDiagram.value = diagram;
}

// === Note actions ===

async function handleSaveNote() {
  if (!editingNote.value) return;
  await $fetch(`/api/project-tracker/projects/${props.projectId}/notes/${editingNote.value.id}`, {
    method: 'PUT',
    body: { title: editTitle.value, content: editContent.value },
  });
  await loadNotes();
}

function closeNoteModal() {
  editingNote.value = null;
}

async function handleSummarize() {
  if (!editingNote.value) return;
  summarizing.value = true;
  try {
    const result = await $fetch<{ summary: string }>(
      `/api/project-tracker/projects/${props.projectId}/notes/${editingNote.value.id}/summarize`,
      { method: 'POST' },
    );
    editingNote.value = { ...editingNote.value, aiSummary: result.summary };
    await loadNotes();
  } finally {
    summarizing.value = false;
  }
}

async function handleAddUrlAttachment(url: string, caption: string) {
  if (!editingNote.value) return;
  const att = await $fetch<Attachment>(
    `/api/project-tracker/projects/${props.projectId}/notes/${editingNote.value.id}/attachments`,
    { method: 'POST', body: { type: 'url', url, caption } },
  );
  editAttachments.value = [...editAttachments.value, att];
}

async function handleAddImageAttachment(file: File) {
  if (!editingNote.value) return;
  const formData = new FormData();
  formData.append('file', file);
  const uploadResult = await $fetch<{ filePath: string }>(
    `/api/project-tracker/uploads/image?projectId=${props.projectId}`,
    { method: 'POST', body: formData },
  );
  const att = await $fetch<Attachment>(
    `/api/project-tracker/projects/${props.projectId}/notes/${editingNote.value.id}/attachments`,
    { method: 'POST', body: { type: 'image', filePath: uploadResult.filePath } },
  );
  editAttachments.value = [...editAttachments.value, att];
}

async function handleRemoveAttachment(attachmentId: number) {
  if (!editingNote.value) return;
  await $fetch(
    `/api/project-tracker/projects/${props.projectId}/notes/${editingNote.value.id}/attachments/${attachmentId}`,
    { method: 'DELETE' },
  );
  editAttachments.value = editAttachments.value.filter(a => a.id !== attachmentId);
}

// === Diagram actions ===

async function handleSaveDiagram(data: { title: string; mermaidCode: string; type: string }) {
  if (!editingDiagram.value) return;
  const updated = await $fetch<Diagram>(
    `/api/project-tracker/projects/${props.projectId}/diagrams/${editingDiagram.value.id}`,
    { method: 'PUT', body: data },
  );
  editingDiagram.value = updated;
  await loadDiagrams();
}

function closeDiagramModal() {
  editingDiagram.value = null;
}

// === Delete ===

function handleDelete(item: MixedItem) {
  deletingItem.value = item;
}

async function confirmDelete() {
  const item = deletingItem.value;
  if (!item) return;
  deletingItem.value = null;
  if (item.kind === 'note') {
    await $fetch(`/api/project-tracker/projects/${props.projectId}/notes/${item.id}`, { method: 'DELETE' });
    await loadNotes();
  } else {
    await $fetch(`/api/project-tracker/projects/${props.projectId}/diagrams/${item.id}`, { method: 'DELETE' });
    await loadDiagrams();
  }
}
</script>

<style scoped>
.ndPane {
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

.paneActions {
  display: flex;
  gap: var(--spacing-xs);
}

.paneBody {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.emptyState {
  text-align: center;
  padding: var(--spacing-lg);
  color: var(--color-text-secondary);
  font-size: 13px;
}

.itemList {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.itemCard {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.itemCard:hover {
  background: var(--color-bg-hover);
}

.cardTop {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.kindBadge {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  font-weight: 600;
  flex-shrink: 0;
}

.kindBadge.note {
  background: var(--color-bg-hover);
  color: var(--color-text-secondary);
}

.kindBadge.diagram {
  background: var(--color-accent);
  color: var(--color-accent-inverse);
}

.itemTitle {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cardActions {
  opacity: 0;
  transition: opacity var(--transition-fast);
  flex-shrink: 0;
}

.itemCard:hover .cardActions {
  opacity: 1;
}

.iconBtn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  opacity: 0.5;
  padding: 2px 6px;
}

.iconBtn:hover {
  opacity: 1;
}

.itemPreview {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: var(--spacing-xs);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.cardMeta {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-xs);
  font-size: 11px;
  color: var(--color-text-disabled);
}

.typeBadge {
  font-size: 10px;
  padding: 0 4px;
  background: var(--color-bg-hover);
  border-radius: 2px;
}
</style>
