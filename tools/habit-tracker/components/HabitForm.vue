<template>
  <BaseModal
    :open="open"
    :title="isEditing ? '编辑习惯' : '创建习惯'"
    max-width="400px"
    @close="$emit('close')"
  >
    <div class="form">
      <input
        ref="inputRef"
        v-model="name"
        class="nameInput"
        type="text"
        placeholder="输入习惯名称..."
        @keydown.enter="handleSubmit"
      />

      <div class="frequencyGroup">
        <button
          v-for="freq in frequencies"
          :key="freq.value"
          class="frequencyBtn"
          :class="{ active: frequency === freq.value }"
          @click="frequency = freq.value"
        >
          {{ freq.label }}
        </button>
      </div>
    </div>

    <template #footer>
      <BaseButton variant="ghost" @click="$emit('close')">
        取消
      </BaseButton>
      <BaseButton
        :disabled="!name.trim() || submitting"
        @click="handleSubmit"
      >
        {{ isEditing ? '保存' : '创建' }}
      </BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import type { Habit, HabitFrequency } from '~/types';

const props = withDefaults(defineProps<{
  open: boolean;
  editHabit?: Habit | null;
}>(), {
  editHabit: null,
});

const emit = defineEmits<{
  close: [];
  submit: [data: { name: string; frequency: HabitFrequency }];
}>();

const isEditing = computed(() => !!props.editHabit);

const name = ref('');
const frequency = ref<HabitFrequency>('daily');
const inputRef = ref<HTMLInputElement | null>(null);
const submitting = ref(false);

const frequencies = [
  { value: 'daily' as const, label: '每天' },
  { value: 'weekly' as const, label: '每周' },
  { value: 'monthly' as const, label: '每月' },
];

// 打开时初始化表单
watch(() => props.open, (isOpen) => {
  if (isOpen) {
    if (props.editHabit) {
      name.value = props.editHabit.name;
      frequency.value = props.editHabit.frequency;
    } else {
      name.value = '';
      frequency.value = 'daily';
    }
    nextTick(() => inputRef.value?.focus());
  }
});

async function handleSubmit() {
  if (!name.value.trim() || submitting.value) return;
  submitting.value = true;
  try {
    emit('submit', { name: name.value.trim(), frequency: frequency.value });
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

.frequencyGroup {
  display: flex;
  gap: var(--spacing-sm);
}

.frequencyBtn {
  flex: 1;
  padding: var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  cursor: pointer;
  font-size: 14px;
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
}

.frequencyBtn:hover {
  background-color: var(--color-bg-hover);
}

.frequencyBtn.active {
  background-color: var(--color-accent);
  color: var(--color-accent-inverse);
  border-color: var(--color-accent);
}
</style>
