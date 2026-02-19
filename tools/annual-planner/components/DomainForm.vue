<template>
  <BaseModal
    :open="open"
    :title="editDomain ? '编辑领域' : '新建领域'"
    max-width="400px"
    @close="$emit('close')"
  >
    <div class="form">
      <input
        ref="inputRef"
        v-model="name"
        class="nameInput"
        type="text"
        placeholder="输入领域名称..."
        @keydown.enter="handleSubmit"
      />
    </div>

    <template #footer>
      <BaseButton variant="ghost" @click="$emit('close')">
        取消
      </BaseButton>
      <BaseButton
        :disabled="!name.trim() || submitting"
        @click="handleSubmit"
      >
        {{ editDomain ? '保存' : '创建' }}
      </BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import type { DomainWithStats } from '../types';

const props = withDefaults(defineProps<{
  open: boolean;
  editDomain?: DomainWithStats | null;
}>(), {
  editDomain: null,
});

const emit = defineEmits<{
  close: [];
  submit: [name: string];
}>();

const name = ref('');
const inputRef = ref<HTMLInputElement | null>(null);
const submitting = ref(false);

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    name.value = props.editDomain?.name ?? '';
    nextTick(() => inputRef.value?.focus());
  }
});

async function handleSubmit() {
  if (!name.value.trim() || submitting.value) return;
  submitting.value = true;
  try {
    emit('submit', name.value.trim());
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.nameInput {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  outline: none;
  transition: border-color var(--transition-fast);
}

.nameInput:focus {
  border-color: var(--color-accent);
}
</style>
