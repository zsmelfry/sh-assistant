<template>
  <Teleport to="body">
    <Transition name="note-fade">
      <div v-if="open" class="noteOverlay" @click.self="close">
        <div class="notePopover" ref="popoverRef">
          <div class="noteHeader">
            <span class="noteDate">{{ formattedDate }}</span>
            <button class="closeBtn" @click="close" aria-label="关闭">×</button>
          </div>
          <textarea
            ref="textareaRef"
            v-model="localNote"
            class="noteInput"
            placeholder="添加备注…"
            rows="3"
            maxlength="200"
            @keydown.meta.enter="close"
            @keydown.ctrl.enter="close"
          />
          <div class="noteFooter">
            <span class="charCount">{{ localNote.length }}/200</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const props = defineProps<{
  open: boolean;
  date: string;
  note: string;
}>();

const emit = defineEmits<{
  close: [];
  save: [note: string];
}>();

const localNote = ref('');
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const popoverRef = ref<HTMLDivElement | null>(null);

const formattedDate = computed(() => {
  if (!props.date) return '';
  const [y, m, d] = props.date.split('-');
  return `${parseInt(m)}月${parseInt(d)}日`;
});

watch(() => props.open, (val) => {
  if (val) {
    localNote.value = props.note || '';
    nextTick(() => {
      textareaRef.value?.focus();
    });
  }
});

watch(() => props.note, (val) => {
  if (props.open) {
    localNote.value = val || '';
  }
});

function close() {
  emit('save', localNote.value);
  emit('close');
}
</script>

<style scoped>
.noteOverlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.notePopover {
  width: 320px;
  max-width: 90vw;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  animation: noteSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes noteSlideUp {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.noteHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-sm) var(--spacing-md);
  border-bottom: 1px solid var(--color-border);
}

.noteDate {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
  letter-spacing: 0.5px;
}

.closeBtn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  color: var(--color-text-secondary);
  font-size: 18px;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.closeBtn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.noteInput {
  width: 100%;
  padding: var(--spacing-md);
  border: none;
  outline: none;
  resize: none;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-text-primary);
  background: transparent;
}

.noteInput::placeholder {
  color: var(--color-text-disabled);
}

.noteFooter {
  display: flex;
  justify-content: flex-end;
  padding: var(--spacing-xs) var(--spacing-md) var(--spacing-sm);
}

.charCount {
  font-size: 11px;
  color: var(--color-text-disabled);
  font-variant-numeric: tabular-nums;
}

/* Transitions */
.note-fade-enter-active {
  transition: opacity 0.2s ease;
}

.note-fade-leave-active {
  transition: opacity 0.15s ease;
}

.note-fade-enter-from,
.note-fade-leave-to {
  opacity: 0;
}

@media (max-width: 768px) {
  .notePopover {
    width: 100%;
    max-width: 100%;
    border-radius: var(--radius-md) var(--radius-md) 0 0;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    animation: noteSlideUpMobile 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes noteSlideUpMobile {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }

  .noteOverlay {
    align-items: flex-end;
  }
}
</style>
