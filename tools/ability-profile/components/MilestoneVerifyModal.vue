<template>
  <BaseModal :open="!!milestone" title="完成里程碑" @close="$emit('close')">
    <div v-if="milestone" class="verify-form">
      <p class="verify-title">{{ milestone.title }}</p>

      <div class="verify-method">
        <label class="field-label">验证方式</label>
        <span class="method-badge">{{ VERIFY_METHOD_LABELS[milestone.verifyMethod] }}</span>
      </div>

      <!-- Evidence upload for 'evidence' type -->
      <template v-if="milestone.verifyMethod === 'evidence'">
        <div v-if="verifyConfig?.description" class="verify-hint">
          {{ verifyConfig.description }}
        </div>
        <div class="field">
          <label class="field-label">证据链接 / 说明</label>
          <input
            v-model="evidenceUrl"
            type="text"
            class="field-input"
            placeholder="URL 或文件路径"
          />
        </div>
        <div class="field">
          <label class="field-label">补充说明</label>
          <textarea
            v-model="evidenceNote"
            class="field-input field-textarea"
            placeholder="可选的补充说明"
            rows="2"
          />
        </div>
      </template>

      <!-- Self declare confirmation -->
      <template v-else-if="milestone.verifyMethod === 'self_declare'">
        <div v-if="verifyConfig?.prompt" class="verify-hint">
          {{ verifyConfig.prompt }}
        </div>
        <label class="confirm-label">
          <input v-model="selfConfirmed" type="checkbox" />
          我确认已达成此里程碑
        </label>
      </template>

      <!-- Platform auto/test -->
      <template v-else>
        <div class="verify-hint">
          此里程碑将通过平台数据自动验证。点击确认以手动标记完成。
        </div>
      </template>
    </div>

    <template #footer>
      <BaseButton variant="ghost" @click="$emit('close')">取消</BaseButton>
      <BaseButton :disabled="!canSubmit" @click="handleSubmit">确认完成</BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import type { Milestone } from '../types';
import { VERIFY_METHOD_LABELS } from '../types';

const props = defineProps<{
  milestone: Milestone | null;
}>();

const emit = defineEmits<{
  close: [];
  submit: [data: { milestoneId: number; verifyMethod: string; evidenceUrl?: string; evidenceNote?: string }];
}>();

const evidenceUrl = ref('');
const evidenceNote = ref('');
const selfConfirmed = ref(false);

const verifyConfig = computed(() => props.milestone?.verifyConfig as Record<string, string> | null);

const canSubmit = computed(() => {
  if (!props.milestone) return false;
  if (props.milestone.verifyMethod === 'self_declare') return selfConfirmed.value;
  if (props.milestone.verifyMethod === 'evidence') return evidenceUrl.value.trim().length > 0;
  return true;
});

watch(() => props.milestone, () => {
  evidenceUrl.value = '';
  evidenceNote.value = '';
  selfConfirmed.value = false;
});

function handleSubmit() {
  if (!props.milestone || !canSubmit.value) return;
  emit('submit', {
    milestoneId: props.milestone.id,
    verifyMethod: props.milestone.verifyMethod,
    evidenceUrl: evidenceUrl.value || undefined,
    evidenceNote: evidenceNote.value || undefined,
  });
}
</script>

<style scoped>
.verify-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.verify-title {
  font-weight: 600;
  font-size: 15px;
  color: var(--color-text-primary);
}

.verify-method {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.method-badge {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  background-color: var(--color-bg-hover);
  color: var(--color-text-secondary);
}

.verify-hint {
  font-size: 13px;
  color: var(--color-text-secondary);
  padding: var(--spacing-sm) var(--spacing-md);
  background-color: var(--color-bg-hover);
  border-radius: var(--radius-sm);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.field-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.field-input {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  color: var(--color-text-primary);
  background-color: var(--color-bg-primary);
}

.field-input:focus {
  outline: none;
  border-color: var(--color-accent);
}

.field-textarea {
  resize: vertical;
  font-family: inherit;
}

.confirm-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: 14px;
  cursor: pointer;
}
</style>
