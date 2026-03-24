<template>
  <Teleport to="body">
    <div class="overlay">
      <div class="dialog">
        <div class="dialogHeader">
          <h2 class="dialogTitle">导出技能</h2>
          <button class="closeBtn" @click="$emit('close')">
            <X :size="18" />
          </button>
        </div>

        <div class="dialogBody">
          <p class="dialogDesc">导出「{{ config.name }}」的配置和知识树数据。</p>

          <div class="options">
            <label class="checkOption">
              <input v-model="includeTeaching" type="checkbox" class="checkbox" />
              <span class="checkLabel">包含教程内容</span>
            </label>
            <label class="checkOption">
              <input v-model="includeNotes" type="checkbox" class="checkbox" />
              <span class="checkLabel">包含笔记</span>
            </label>
          </div>

          <div v-if="error" class="errorMsg">{{ error }}</div>
        </div>

        <div class="dialogFooter">
          <button class="footerBtn secondary" @click="$emit('close')">取消</button>
          <button class="footerBtn primary" :disabled="exporting" @click="handleExport">
            {{ exporting ? '导出中...' : '导出' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { X } from 'lucide-vue-next';
import type { SkillConfig } from '../types';

const props = defineProps<{
  config: SkillConfig;
}>();

defineEmits<{
  close: [];
}>();

const includeTeaching = ref(false);
const includeNotes = ref(false);
const exporting = ref(false);
const error = ref('');

async function handleExport() {
  exporting.value = true;
  error.value = '';
  try {
    const params = new URLSearchParams();
    if (includeTeaching.value) params.set('includeTeaching', '1');
    if (includeNotes.value) params.set('includeNotes', '1');

    const qs = params.toString();
    const url = `/api/skill-configs/${props.config.id}/export${qs ? '?' + qs : ''}`;
    const data = await $fetch(url);

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${props.config.skillId}-export.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (e: unknown) {
    error.value = extractErrorMessage(e, '导出失败');
  } finally {
    exporting.value = false;
  }
}
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: var(--color-bg-primary);
  border-radius: var(--radius-md);
  width: 90%;
  max-width: 440px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dialogHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md) var(--spacing-lg);
  border-bottom: 1px solid var(--color-border);
}

.dialogTitle {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.closeBtn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text-secondary);
  padding: var(--spacing-xs);
  border-radius: var(--radius-sm);
  transition: color var(--transition-fast);
}

.closeBtn:hover {
  color: var(--color-text-primary);
}

.dialogBody {
  padding: var(--spacing-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.dialogDesc {
  font-size: 14px;
  color: var(--color-text-secondary);
}

.options {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.checkOption {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  cursor: pointer;
}

.checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--color-accent);
  cursor: pointer;
}

.checkLabel {
  font-size: 14px;
  color: var(--color-text-primary);
}

.errorMsg {
  font-size: 13px;
  color: var(--color-danger);
  padding: var(--spacing-sm);
  background: var(--color-danger-bg);
  border-radius: var(--radius-sm);
}

.dialogFooter {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-lg);
  border-top: 1px solid var(--color-border);
}

.footerBtn {
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}

.footerBtn.primary {
  background: var(--color-accent);
  color: var(--color-accent-inverse);
  border: 1px solid var(--color-accent);
}

.footerBtn.secondary {
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
}

.footerBtn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.footerBtn:hover:not(:disabled) {
  opacity: 0.85;
}

@media (max-width: 768px) {
  .dialog {
    width: 100%;
    max-width: none;
    margin: var(--spacing-md);
  }
  .footerBtn {
    min-height: var(--touch-target-min);
  }
}
</style>
