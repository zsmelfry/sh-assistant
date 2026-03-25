<template>
  <div class="module-toggles">
    <div class="toggles-label">模块权限</div>
    <div class="toggle-grid">
      <div
        v-for="mod in ALL_MODULES"
        :key="mod.id"
        class="toggle-item"
        :class="{ enabled: isEnabled(mod.id) }"
        @click="$emit('change', mod.id, !isEnabled(mod.id))"
      >
        <span class="toggle-name">{{ mod.name }}</span>
        <button
          class="toggle-switch"
          :class="{ active: isEnabled(mod.id) }"
          role="switch"
          :aria-checked="isEnabled(mod.id)"
          @click.stop="$emit('change', mod.id, !isEnabled(mod.id))"
        >
          <span class="toggle-knob" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const ALL_MODULES = [
  { id: 'dashboard', name: '今日' },
  { id: 'ability-profile', name: '能力画像' },
  { id: 'habit-tracker', name: '日历打卡' },
  { id: 'annual-planner', name: '年度计划' },
  { id: 'vocab-tracker', name: '词汇学习' },
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
.module-toggles {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.toggles-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--color-text-tertiary);
  font-weight: 600;
}

.toggle-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: var(--spacing-xs);
}

.toggle-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-sm) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  background: var(--color-bg-primary);
}

.toggle-item:hover {
  border-color: var(--color-text-tertiary);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
}

.toggle-item.enabled {
  border-color: var(--color-accent);
  background: var(--color-bg-primary);
}

.toggle-name {
  font-size: 13px;
  color: var(--color-text-primary);
  font-weight: 500;
}

/* Toggle switch */
.toggle-switch {
  position: relative;
  width: 36px;
  height: 20px;
  background: var(--color-border);
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.25s ease;
  flex-shrink: 0;
  padding: 0;
}

.toggle-switch.active {
  background: var(--color-accent);
}

.toggle-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  background: var(--color-bg-primary);
  border-radius: 50%;
  transition: transform 0.25s ease;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
}

.toggle-switch.active .toggle-knob {
  transform: translateX(16px);
}

@media (max-width: 768px) {
  .toggle-grid {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  }
}
</style>
