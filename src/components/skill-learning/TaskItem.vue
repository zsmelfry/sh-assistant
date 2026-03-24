<template>
  <div class="taskItem" :class="{ completed: task.isCompleted }">
    <div class="taskHeader">
      <button
        class="completeBtn"
        :class="{ checked: task.isCompleted }"
        @click="toggleComplete"
      >
        <Check v-if="task.isCompleted" :size="14" />
      </button>
      <div class="taskContent">
        <p class="taskDesc">{{ task.description }}</p>
        <p v-if="task.expectedOutput" class="taskMeta">
          <span class="metaLabel">预期产出：</span>{{ task.expectedOutput }}
        </p>
        <p v-if="task.hint" class="taskMeta">
          <span class="metaLabel">参考提示：</span>{{ task.hint }}
        </p>
      </div>
    </div>

    <!-- Completion note (for completed tasks, collapsible) -->
    <div v-if="task.isCompleted && task.completionNote" class="completionArea">
      <button class="noteToggle" @click="showNote = !showNote">
        {{ showNote ? '收起心得' : '查看心得' }}
      </button>
      <p v-if="showNote" class="completionNote">{{ task.completionNote }}</p>
    </div>

    <!-- Note input (shown when marking as complete) -->
    <div v-if="showNoteInput" class="noteInputArea">
      <textarea
        v-model="noteText"
        class="noteInput"
        placeholder="填写完成心得（可选）..."
        rows="2"
      />
      <div class="noteActions">
        <button class="actionBtn confirm" @click="confirmComplete">确认完成</button>
        <button class="actionBtn cancel" @click="cancelComplete">取消</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Check } from 'lucide-vue-next';
import type { SmTask } from '~/composables/skill-learning/types';

const props = defineProps<{
  task: SmTask;
}>();

const emit = defineEmits<{
  update: [taskId: number, data: { isCompleted: boolean; completionNote?: string }];
}>();

const showNote = ref(false);
const showNoteInput = ref(false);
const noteText = ref('');

function toggleComplete() {
  if (props.task.isCompleted) {
    // Uncomplete — keep existing note
    emit('update', props.task.id, { isCompleted: false });
  } else {
    // Show note input before completing
    showNoteInput.value = true;
    noteText.value = '';
  }
}

function confirmComplete() {
  emit('update', props.task.id, {
    isCompleted: true,
    completionNote: noteText.value.trim() || undefined,
  });
  showNoteInput.value = false;
}

function cancelComplete() {
  showNoteInput.value = false;
  noteText.value = '';
}
</script>

<style scoped>
.taskItem {
  padding: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.taskItem.completed {
  opacity: 0.7;
}

.taskHeader {
  display: flex;
  gap: var(--spacing-sm);
  align-items: flex-start;
}

.completeBtn {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border: 2px solid var(--color-border);
  border-radius: 50%;
  background: var(--color-bg-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
  margin-top: 1px;
}

.completeBtn:hover {
  border-color: var(--color-accent);
}

.completeBtn.checked {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-accent-inverse);
}

.taskContent {
  flex: 1;
  min-width: 0;
}

.taskDesc {
  font-size: 14px;
  color: var(--color-text-primary);
  line-height: 1.5;
}

.taskItem.completed .taskDesc {
  text-decoration: line-through;
}

.taskMeta {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-top: var(--spacing-xs);
  line-height: 1.4;
}

.metaLabel {
  font-weight: 600;
}

/* Completion area */
.completionArea {
  margin-top: var(--spacing-sm);
  padding-left: 30px;
}

.noteToggle {
  border: none;
  background: none;
  color: var(--color-text-secondary);
  font-size: 12px;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
}

.noteToggle:hover {
  color: var(--color-text-primary);
}

.completionNote {
  margin-top: var(--spacing-xs);
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.4;
  padding: var(--spacing-sm);
  background: var(--color-bg-sidebar);
  border-radius: var(--radius-sm);
}

/* Note input */
.noteInputArea {
  margin-top: var(--spacing-sm);
  padding-left: 30px;
}

.noteInput {
  width: 100%;
  padding: var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-family: inherit;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  resize: vertical;
  min-height: 48px;
  outline: none;
  transition: border-color var(--transition-fast);
}

.noteInput:focus {
  border-color: var(--color-accent);
}

.noteInput::placeholder {
  color: var(--color-text-disabled);
}

.noteActions {
  display: flex;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-sm);
}

.actionBtn {
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.actionBtn.confirm {
  border: 1px solid var(--color-accent);
  background: var(--color-accent);
  color: var(--color-accent-inverse);
}

.actionBtn.confirm:hover {
  opacity: 0.85;
}

.actionBtn.cancel {
  border: 1px solid var(--color-border);
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
}

.actionBtn.cancel:hover {
  background: var(--color-bg-hover);
}

@media (max-width: 768px) {
  .actionBtn {
    min-height: var(--touch-target-min);
  }
}
</style>
