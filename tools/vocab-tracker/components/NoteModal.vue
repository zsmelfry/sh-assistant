<template>
  <BaseModal :open="open" title="笔记" max-width="480px" @close="$emit('close')">
    <p class="noteWord">{{ word }}</p>
    <textarea
      v-model="noteText"
      class="noteInput"
      placeholder="在这里写下你的笔记..."
      :disabled="isSaving"
    ></textarea>

    <template #footer>
      <BaseButton variant="ghost" :disabled="isSaving" @click="$emit('close')">
        取消
      </BaseButton>
      <BaseButton :disabled="isSaving" @click="handleSave">
        {{ isSaving ? '保存中...' : '保存' }}
      </BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
const props = defineProps<{
  open: boolean;
  wordId: number | null;
  word: string;
  initialNote: string;
}>();

const emit = defineEmits<{
  close: [];
  saved: [note: string];
}>();

const noteText = ref('');
const isSaving = ref(false);

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    noteText.value = props.initialNote;
  }
});

async function handleSave() {
  if (props.wordId === null) return;
  isSaving.value = true;
  try {
    await $fetch('/api/vocab/progress/status', {
      method: 'POST',
      body: {
        wordId: props.wordId,
        action: 'UPDATE_NOTE',
        note: noteText.value,
      },
    });
    emit('saved', noteText.value);
    emit('close');
  } catch {
    // silent error
  } finally {
    isSaving.value = false;
  }
}
</script>

<style scoped>
.noteWord {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-sm);
}

.noteInput {
  width: 100%;
  height: 140px;
  padding: var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  resize: none;
}

.noteInput:focus {
  outline: none;
  border-color: var(--color-accent);
}

.noteInput:disabled {
  opacity: 0.5;
}
</style>
