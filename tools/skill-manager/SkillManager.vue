<template>
  <div class="skillManager">
    <div class="header">
      <h1 class="title">技能管理</h1>
      <button class="createBtn" @click="showWizard = true">
        <Plus :size="16" />
        创建技能
      </button>
    </div>

    <SkillList
      :configs="configs"
      :loading="loading"
      @edit="handleEdit"
      @export="handleExport"
      @delete="handleDelete"
    />

    <SkillWizard
      v-if="showWizard"
      :editing="editingConfig"
      @close="closeWizard"
      @saved="handleSaved"
    />

    <ExportDialog
      v-if="exportingConfig"
      :config="exportingConfig"
      @close="exportingConfig = null"
    />
  </div>
</template>

<script setup lang="ts">
import { Plus } from 'lucide-vue-next';
import SkillList from './components/SkillList.vue';
import SkillWizard from './components/SkillWizard.vue';
import ExportDialog from './components/ExportDialog.vue';
import { registerSkillTools } from '~/plugins/tools.client';
import type { SkillConfig } from './types';

const configs = ref<SkillConfig[]>([]);
const loading = ref(false);
const showWizard = ref(false);
const editingConfig = ref<SkillConfig | null>(null);
const exportingConfig = ref<SkillConfig | null>(null);

async function loadConfigs() {
  loading.value = true;
  try {
    configs.value = await $fetch<SkillConfig[]>('/api/skill-configs');
  } catch {
    configs.value = [];
  } finally {
    loading.value = false;
  }
}

function handleExport(config: SkillConfig) {
  exportingConfig.value = config;
}

function handleEdit(config: SkillConfig) {
  editingConfig.value = config;
  showWizard.value = true;
}

async function handleDelete(config: SkillConfig) {
  if (!confirm(`确认删除技能「${config.name}」？所有相关数据将被清除。`)) return;

  try {
    await $fetch(`/api/skill-configs/${config.id}`, { method: 'DELETE' });
    const { unregister } = useToolRegistry();
    unregister(config.skillId);
    await loadConfigs();
  } catch (e: unknown) {
    alert(extractErrorMessage(e, '删除失败'));
  }
}

function closeWizard() {
  showWizard.value = false;
  editingConfig.value = null;
}

async function handleSaved() {
  closeWizard();
  await loadConfigs();
  await registerSkillTools();
}

onMounted(() => {
  loadConfigs();
});
</script>

<style scoped>
.skillManager {
  max-width: 960px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.title {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.createBtn {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: var(--color-accent-inverse);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}

.createBtn:hover {
  opacity: 0.85;
}

@media (max-width: 768px) {
  .title {
    font-size: 18px;
  }
  .createBtn {
    min-height: var(--touch-target-min);
  }
}
</style>
