<template>
  <div class="state-panel">
    <div class="state-header">
      <h4 class="state-title">当前状态</h4>
      <BaseButton v-if="!editing" variant="ghost" @click="startEdit">编辑</BaseButton>
      <div v-else class="state-actions">
        <BaseButton variant="ghost" @click="cancelEdit">取消</BaseButton>
        <BaseButton @click="saveEdit">保存</BaseButton>
      </div>
    </div>

    <div v-if="states.length === 0" class="state-empty">
      暂无状态记录
    </div>

    <div v-else class="state-list">
      <div v-for="state in states" :key="state.stateKey" class="state-item">
        <div class="state-label">{{ state.stateLabel }}</div>
        <div v-if="!editing" class="state-value-row">
          <span class="state-value">{{ state.stateValue || '-' }}</span>
          <span v-if="state.isExpired" class="state-expired">已过期</span>
          <span v-else-if="state.expiresAfterDays > 0" class="state-confirmed">
            {{ formatConfirmedAt(state.confirmedAt) }}
          </span>
        </div>
        <input
          v-else
          v-model="editValues[state.stateKey]"
          type="text"
          class="state-input"
          :placeholder="state.stateLabel"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SkillCurrentState } from '../types';

const props = defineProps<{
  states: SkillCurrentState[];
}>();

const emit = defineEmits<{
  save: [states: Array<{ stateKey: string; stateValue: string; stateLabel: string }>];
}>();

const editing = ref(false);
const editValues = ref<Record<string, string>>({});

function startEdit() {
  editValues.value = {};
  for (const s of props.states) {
    editValues.value[s.stateKey] = s.stateValue;
  }
  editing.value = true;
}

function cancelEdit() {
  editing.value = false;
}

function saveEdit() {
  const updates = props.states.map((s) => ({
    stateKey: s.stateKey,
    stateValue: editValues.value[s.stateKey] || '',
    stateLabel: s.stateLabel,
  }));
  emit('save', updates);
  editing.value = false;
}

function formatConfirmedAt(ts: number) {
  const days = Math.floor((Date.now() - ts) / (24 * 60 * 60 * 1000));
  if (days === 0) return '今天确认';
  if (days < 30) return `${days}天前确认`;
  if (days < 365) return `${Math.floor(days / 30)}个月前确认`;
  return `${Math.floor(days / 365)}年前确认`;
}
</script>

<style scoped>
.state-panel {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
}

.state-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
}

.state-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.state-actions {
  display: flex;
  gap: var(--spacing-xs);
}

.state-empty {
  font-size: 13px;
  color: var(--color-text-secondary);
  text-align: center;
  padding: var(--spacing-md);
}

.state-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.state-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-xs) 0;
}

.state-label {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.state-value-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.state-value {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.state-expired {
  font-size: 11px;
  color: var(--color-danger);
  padding: 1px 4px;
  border-radius: 2px;
  background-color: var(--color-danger-bg);
}

.state-confirmed {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.state-input {
  width: 120px;
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  text-align: right;
}

.state-input:focus {
  outline: none;
  border-color: var(--color-accent);
}
</style>
