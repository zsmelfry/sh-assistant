<template>
  <div class="tagsPage">
    <div class="pageHeader">
      <h2 class="sectionTitle">标签聚合</h2>
      <BaseButton @click="$emit('manageTags')">管理标签</BaseButton>
    </div>

    <EmptyState
      v-if="tagStats.length === 0"
      title="还没有标签"
      hint="创建标签来标记你的能力维度，如「法语」、「管理」"
      action-label="新建标签"
      @action="$emit('manageTags')"
    />

    <div v-else class="tagGroup">
      <TagGroupCard
        v-for="stat in tagStats"
        :key="stat.id"
        :tag-stat="stat"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TagStats } from '../types';
import EmptyState from './EmptyState.vue';
import TagGroupCard from './TagGroupCard.vue';

defineProps<{
  tagStats: TagStats[];
}>();

defineEmits<{
  manageTags: [];
}>();
</script>

<style scoped>
.tagsPage {
  padding: var(--spacing-lg);
}

.pageHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-lg);
}

.sectionTitle {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.tagGroup {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}
</style>
