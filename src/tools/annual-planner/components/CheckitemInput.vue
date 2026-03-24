<template>
  <div class="checkitemInput">
    <input
      ref="inputRef"
      v-model="content"
      class="input"
      type="text"
      placeholder="输入检查项内容，回车确认..."
      @keydown.enter="handleSubmit"
      @keydown.escape="$emit('cancel')"
    />
    <button class="cancelBtn" title="取消" @click="$emit('cancel')">&times;</button>
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  submit: [content: string];
  cancel: [];
}>();

const content = ref('');
const inputRef = ref<HTMLInputElement | null>(null);

onMounted(() => {
  inputRef.value?.focus();
});

function handleSubmit() {
  const trimmed = content.value.trim();
  if (!trimmed) return;
  emit('submit', trimmed);
  content.value = '';
}
</script>

<style scoped>
.checkitemInput {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) 0 var(--spacing-xs);
}

.input {
  width: 260px;
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  outline: none;
  transition: border-color var(--transition-fast);
}

.input:focus {
  border-color: var(--color-accent);
}

.cancelBtn {
  background: none;
  border: none;
  font-size: 18px;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: 0 var(--spacing-xs);
  line-height: 1;
  transition: color var(--transition-fast);
}

.cancelBtn:hover {
  color: var(--color-text-primary);
}
</style>
