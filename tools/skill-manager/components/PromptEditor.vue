<template>
  <div class="promptEditor">
    <div class="fieldGroup">
      <label class="fieldLabel">{{ label }}</label>
      <div class="editorWrap">
        <textarea
          ref="textareaRef"
          :value="modelValue"
          class="textarea"
          :rows="rows"
          :placeholder="placeholder"
          @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
        />
        <div class="chips">
          <button
            v-for="v in TEMPLATE_VARIABLES"
            :key="v"
            type="button"
            class="chip"
            @click="insertVariable(v)"
          >
            {{ v }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const TEMPLATE_VARIABLES = [
  '{{skill.name}}',
  '{{skill.description}}',
  '{{domain.name}}',
  '{{topic.name}}',
  '{{point.name}}',
  '{{point.description}}',
  '{{teachingSummary}}',
];

defineProps<{
  modelValue: string;
  label: string;
  placeholder?: string;
  rows?: number;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const textareaRef = ref<HTMLTextAreaElement | null>(null);

function insertVariable(variable: string) {
  const el = textareaRef.value;
  if (!el) return;

  const start = el.selectionStart;
  const end = el.selectionEnd;
  const text = el.value;
  const newText = text.slice(0, start) + variable + text.slice(end);

  emit('update:modelValue', newText);

  nextTick(() => {
    el.focus();
    const pos = start + variable.length;
    el.setSelectionRange(pos, pos);
  });
}
</script>

<style scoped>
.promptEditor {
  display: flex;
  flex-direction: column;
}

.fieldGroup {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.fieldLabel {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.editorWrap {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.textarea {
  width: 100%;
  padding: var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-family: 'SF Mono', Monaco, Consolas, monospace;
  line-height: 1.5;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  resize: vertical;
}

.textarea:focus {
  border-color: var(--color-accent);
  outline: none;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

.chip {
  padding: 2px var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-hover);
  color: var(--color-text-secondary);
  font-size: 11px;
  font-family: 'SF Mono', Monaco, Consolas, monospace;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.chip:hover {
  border-color: var(--color-accent);
  color: var(--color-text-primary);
}
</style>
