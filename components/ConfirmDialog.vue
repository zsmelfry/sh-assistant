<template>
  <BaseModal :open="open" :title="title" max-width="400px" @close="$emit('cancel')">
    <p class="confirm-message">{{ message }}</p>

    <template #footer>
      <BaseButton variant="ghost" @click="$emit('cancel')">
        取消
      </BaseButton>
      <BaseButton :variant="danger ? 'danger' : 'primary'" @click="$emit('confirm')">
        {{ confirmText }}
      </BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
}>(), {
  confirmText: '确认',
  danger: false,
});

defineEmits<{
  confirm: [];
  cancel: [];
}>();
</script>

<style scoped>
.confirm-message {
  font-size: 14px;
  color: var(--color-text-secondary);
  line-height: 1.6;
}
</style>
