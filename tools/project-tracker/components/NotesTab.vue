<template>
  <div class="notesTab">
    <!-- Note list view -->
    <template v-if="!editingNote">
      <div class="notesHeader">
        <BaseButton size="sm" @click="handleCreate">+ 新笔记</BaseButton>
      </div>

      <div v-if="notes.length === 0" class="emptyNotes">
        还没有笔记
      </div>

      <div v-else class="noteList">
        <NoteCard
          v-for="note in notes"
          :key="note.id"
          :note="note"
          @click="openNote(note)"
          @delete="handleDelete(note.id)"
        />
      </div>
    </template>

    <!-- Note editor view -->
    <NoteEditor
      v-else
      :note="editingNote"
      :title="editTitle"
      :content="editContent"
      :attachments="editAttachments"
      :summarizing="summarizing"
      @back="editingNote = null"
      @save="handleSave"
      @summarize="handleSummarize"
      @update:title="editTitle = $event"
      @update:content="editContent = $event"
      @add-url-attachment="handleAddUrlAttachment"
      @add-image-attachment="handleAddImageAttachment"
      @remove-attachment="handleRemoveAttachment"
    />
  </div>
</template>

<script setup lang="ts">
import type { Note, NoteWithAttachments, Attachment } from '../types';
import NoteCard from './NoteCard.vue';
import NoteEditor from './NoteEditor.vue';

const props = defineProps<{
  projectId: number;
}>();

const notes = ref<Note[]>([]);
const editingNote = ref<Note | null>(null);
const editTitle = ref('');
const editContent = ref('');
const editAttachments = ref<Attachment[]>([]);
const summarizing = ref(false);

async function loadNotes() {
  notes.value = await $fetch<Note[]>(`/api/project-tracker/projects/${props.projectId}/notes`);
}

onMounted(loadNotes);

async function handleCreate() {
  const note = await $fetch<Note>(`/api/project-tracker/projects/${props.projectId}/notes`, {
    method: 'POST',
    body: { title: '新笔记' },
  });
  await loadNotes();
  openNote(note);
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

async function handleSave() {
  if (!editingNote.value) return;
  await $fetch(`/api/project-tracker/projects/${props.projectId}/notes/${editingNote.value.id}`, {
    method: 'PUT',
    body: { title: editTitle.value, content: editContent.value },
  });
  await loadNotes();
}

async function handleDelete(noteId: number) {
  await $fetch(`/api/project-tracker/projects/${props.projectId}/notes/${noteId}`, { method: 'DELETE' });
  await loadNotes();
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
</script>

<style scoped>
.notesTab {
  padding: var(--spacing-sm) 0;
}

.notesHeader {
  margin-bottom: var(--spacing-md);
}

.emptyNotes {
  text-align: center;
  padding: var(--spacing-xl);
  color: var(--color-text-secondary);
}

.noteList {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}
</style>
