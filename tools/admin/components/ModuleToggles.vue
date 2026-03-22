<template>
  <div class="module-toggles">
    <div class="toggle-grid">
      <label
        v-for="mod in ALL_MODULES"
        :key="mod.id"
        class="toggle-item"
      >
        <input
          type="checkbox"
          :checked="isEnabled(mod.id)"
          @change="$emit('change', mod.id, ($event.target as HTMLInputElement).checked)"
        />
        <span>{{ mod.name }}</span>
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
const ALL_MODULES = [
  { id: 'dashboard', name: '今日' },
  { id: 'ability-profile', name: '能力画像' },
  { id: 'habit-tracker', name: '日历打卡' },
  { id: 'annual-planner', name: '年度计划' },
  { id: 'vocab-tracker', name: '法语词汇' },
  { id: 'article-reader', name: '文章阅读' },
  { id: 'project-tracker', name: '事项追踪' },
  { id: 'skill-manager', name: '技能管理' },
  { id: 'xiaoshuang', name: '小爽 AI' },
];

const props = defineProps<{
  modules: Array<{ moduleId: string; enabled: boolean }>;
}>();

defineEmits<{
  change: [moduleId: string, enabled: boolean];
}>();

function isEnabled(moduleId: string): boolean {
  const mod = props.modules.find((m) => m.moduleId === moduleId);
  return mod?.enabled ?? false;
}
</script>

<style scoped>
.toggle-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: var(--spacing-xs);
}

.toggle-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 13px;
}

.toggle-item:hover {
  background: var(--color-bg);
}

input[type="checkbox"] {
  cursor: pointer;
}
</style>
