<template>
  <div class="skillList">
    <!-- Loading -->
    <div v-if="loading" class="emptyState">加载中...</div>

    <!-- Empty -->
    <div v-else-if="configs.length === 0" class="emptyState">
      <p class="emptyTitle">暂无技能</p>
      <p class="emptyDesc">点击「创建技能」添加你的第一个学习技能</p>
    </div>

    <!-- Grid -->
    <div v-else class="grid">
      <div
        v-for="config in configs"
        :key="config.id"
        class="card"
      >
        <div class="cardHeader">
          <div class="iconWrap">
            <component :is="getIcon(config.icon)" :size="20" />
          </div>
          <div class="cardInfo">
            <h3 class="cardName">{{ config.name }}</h3>
            <p v-if="config.description" class="cardDesc">{{ config.description }}</p>
          </div>
        </div>

        <div class="cardMeta">
          <span class="metaItem">ID: {{ config.skillId }}</span>
          <span class="metaItem">排序: {{ config.sortOrder }}</span>
          <span class="statusBadge" :class="config.isActive ? 'active' : 'inactive'">
            {{ config.isActive ? '启用' : '停用' }}
          </span>
        </div>

        <div class="cardActions">
          <button class="actionBtn" @click="$emit('edit', config)">
            <Pencil :size="14" />
            编辑
          </button>
          <button class="actionBtn" @click="$emit('export', config)">
            <Download :size="14" />
            导出
          </button>
          <button class="actionBtn danger" @click="$emit('delete', config)">
            <Trash2 :size="14" />
            删除
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Download, Pencil, Trash2 } from 'lucide-vue-next';
import { resolveIcon } from '~/utils/icon-map';
import type { SkillConfig } from '../types';

defineProps<{
  configs: SkillConfig[];
  loading: boolean;
}>();

defineEmits<{
  edit: [config: SkillConfig];
  export: [config: SkillConfig];
  delete: [config: SkillConfig];
}>();

function getIcon(name: string) {
  return resolveIcon(name);
}
</script>

<style scoped>
.skillList {
  min-height: 200px;
}

.emptyState {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: var(--color-text-secondary);
  font-size: 14px;
}

.emptyTitle {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-xs);
}

.emptyDesc {
  color: var(--color-text-secondary);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--spacing-md);
}

.card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  transition: border-color var(--transition-fast);
}

.card:hover {
  border-color: var(--color-text-secondary);
}

.cardHeader {
  display: flex;
  gap: var(--spacing-sm);
}

.iconWrap {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-primary);
}

.cardInfo {
  flex: 1;
  min-width: 0;
}

.cardName {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-xs);
}

.cardDesc {
  font-size: 13px;
  color: var(--color-text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.cardMeta {
  display: flex;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
  align-items: center;
}

.metaItem {
  font-size: 12px;
  color: var(--color-text-disabled);
}

.statusBadge {
  font-size: 12px;
  padding: 2px var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-weight: 500;
}

.statusBadge.active {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.statusBadge.inactive {
  background: var(--color-bg-hover);
  color: var(--color-text-secondary);
}

.cardActions {
  display: flex;
  gap: var(--spacing-sm);
  border-top: 1px solid var(--color-border);
  padding-top: var(--spacing-sm);
}

.actionBtn {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.actionBtn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.actionBtn.danger:hover {
  border-color: var(--color-danger);
  color: var(--color-danger);
  background: var(--color-danger-bg);
}

@media (max-width: 768px) {
  .grid {
    grid-template-columns: 1fr;
  }
  .actionBtn {
    min-height: var(--touch-target-min);
  }
}
</style>
