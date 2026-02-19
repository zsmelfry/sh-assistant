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
  padding: var(--spacing-xs) 0;
}

.input {
  width: 100%;
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
</style>
