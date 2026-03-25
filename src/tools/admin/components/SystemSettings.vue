<template>
  <div class="system-settings">
    <div class="section-header" @click="expanded = !expanded">
      <div class="section-title-row">
        <div class="section-icon">
          <Settings :size="16" />
        </div>
        <h3>系统设置</h3>
      </div>
      <ChevronDown :size="16" class="expand-arrow" :class="{ rotated: expanded }" />
    </div>

    <Transition name="slide">
      <div v-if="expanded" class="section-body">
        <div v-if="loading" class="setting-loading">
          <span class="pulse-dot" />
          <span>加载中...</span>
        </div>
        <div v-else class="setting-row">
          <div class="setting-info">
            <span class="setting-label">多词汇本模式</span>
            <span class="setting-desc">允许创建多个不同语言的词汇本 <span class="setting-note">(仅影响当前用户)</span></span>
          </div>
          <button
            class="toggle-switch"
            :class="{ active: multiWordbookEnabled }"
            :disabled="saving"
            role="switch"
            :aria-checked="multiWordbookEnabled"
            @click="toggleMultiWordbook"
          >
            <span class="toggle-knob" />
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { Settings, ChevronDown } from 'lucide-vue-next';

const expanded = ref(true);
const loading = ref(true);
const saving = ref(false);
const multiWordbookEnabled = ref(false);

async function fetchSettings() {
  loading.value = true;
  try {
    const data = await $fetch<Record<string, string>>('/api/vocab/settings');
    multiWordbookEnabled.value = data.multi_wordbook_enabled === 'true';
  } catch {
    // Settings may not exist yet, default to false
  } finally {
    loading.value = false;
  }
}

async function toggleMultiWordbook() {
  saving.value = true;
  const newValue = !multiWordbookEnabled.value;
  try {
    await $fetch('/api/vocab/settings', {
      method: 'PUT',
      body: { key: 'multi_wordbook_enabled', value: newValue ? 'true' : 'false' },
    });
    multiWordbookEnabled.value = newValue;
  } catch (e: any) {
    alert(e?.data?.message || '保存设置失败');
  } finally {
    saving.value = false;
  }
}

onMounted(fetchSettings);
</script>

<style scoped>
.system-settings {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md);
  cursor: pointer;
  transition: background var(--transition-fast);
  user-select: none;
}

.section-header:hover {
  background: var(--color-bg-hover);
}

.section-title-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.section-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: var(--color-accent);
  color: var(--color-accent-inverse);
  border-radius: var(--radius-sm);
}

h3 {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: var(--color-text-primary);
}

.expand-arrow {
  transition: transform 0.25s ease;
  color: var(--color-text-tertiary);
}

.expand-arrow.rotated {
  transform: rotate(180deg);
}

.section-body {
  border-top: 1px solid var(--color-border);
  padding: var(--spacing-md);
}

.setting-loading {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  color: var(--color-text-secondary);
  font-size: 13px;
  padding: var(--spacing-xs) 0;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-text-tertiary);
  animation: pulse 1.2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  padding: var(--spacing-sm) 0;
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.setting-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.setting-desc {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.setting-note {
  color: var(--color-text-tertiary);
  font-style: italic;
}

/* Custom toggle switch */
.toggle-switch {
  position: relative;
  width: 44px;
  height: 24px;
  background: var(--color-border);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.25s ease;
  flex-shrink: 0;
  padding: 0;
}

.toggle-switch:hover {
  border-color: var(--color-text-tertiary);
}

.toggle-switch.active {
  background: var(--color-accent);
  border-color: var(--color-accent);
}

.toggle-switch:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.toggle-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  background: var(--color-bg-primary);
  border-radius: 50%;
  transition: transform 0.25s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}

.toggle-switch.active .toggle-knob {
  transform: translateX(20px);
}

/* Slide transition */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.25s ease;
  overflow: hidden;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.slide-enter-to,
.slide-leave-from {
  opacity: 1;
  max-height: 200px;
}

@media (max-width: 768px) {
  .setting-row {
    gap: var(--spacing-sm);
  }
}
</style>
