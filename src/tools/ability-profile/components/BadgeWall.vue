<template>
  <div class="badge-wall">
    <div class="badge-header">
      <button class="back-btn" @click="$emit('back')">← 返回</button>
      <h2 class="page-title">荣誉墙</h2>
    </div>

    <div class="badge-stats">
      <span>已获得 {{ awardedCount }} / {{ badges.length }}</span>
    </div>

    <!-- Awarded badges -->
    <div v-if="awarded.length > 0" class="badge-section">
      <h3 class="section-title">已获得</h3>
      <div class="badge-grid">
        <div
          v-for="badge in awarded"
          :key="badge.id"
          class="badge-card badge-card--awarded"
          :class="`rarity-${badge.rarity}`"
        >
          <span class="badge-icon">🏅</span>
          <span class="badge-name">{{ badge.name }}</span>
          <span class="badge-desc">{{ badge.description }}</span>
          <span class="badge-date">{{ formatDate(badge.awardedAt!) }}</span>
          <span class="badge-rarity">{{ RARITY_LABELS[badge.rarity] }}</span>
        </div>
      </div>
    </div>

    <!-- Locked badges -->
    <div v-if="locked.length > 0" class="badge-section">
      <h3 class="section-title">未获得</h3>
      <div class="badge-grid">
        <div
          v-for="badge in locked"
          :key="badge.id"
          class="badge-card badge-card--locked"
        >
          <span class="badge-icon badge-icon--locked">🔒</span>
          <span class="badge-name">{{ badge.name }}</span>
          <span class="badge-desc">{{ badge.description }}</span>
          <span class="badge-rarity">{{ RARITY_LABELS[badge.rarity] }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Badge } from '../types';
import { RARITY_LABELS } from '../types';

const props = defineProps<{
  badges: Badge[];
}>();

defineEmits<{
  back: [];
}>();

const awarded = computed(() => props.badges.filter((b) => b.awarded));
const locked = computed(() => props.badges.filter((b) => !b.awarded));
const awardedCount = computed(() => awarded.value.length);

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });
}
</script>

<style scoped>
.badge-wall {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.badge-header {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.back-btn {
  align-self: flex-start;
  background: none;
  border: none;
  font-size: 14px;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: var(--spacing-xs) 0;
}

.back-btn:hover {
  color: var(--color-text-primary);
}

.page-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.badge-stats {
  font-size: 14px;
  color: var(--color-text-secondary);
}

.badge-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.badge-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--spacing-md);
}

.badge-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  text-align: center;
}

.badge-card--awarded {
  background-color: var(--color-bg-primary);
}

.badge-card--locked {
  opacity: 0.5;
}

.rarity-rare {
  border-color: var(--color-text-secondary);
}

.rarity-epic {
  border-color: var(--color-accent);
  border-width: 2px;
}

.rarity-legendary {
  border-color: var(--color-accent);
  border-width: 2px;
  box-shadow: 0 0 8px rgba(0, 0, 0, 0.1);
}

.badge-icon {
  font-size: 32px;
}

.badge-icon--locked {
  font-size: 24px;
}

.badge-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--color-text-primary);
}

.badge-desc {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.badge-date {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.badge-rarity {
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 2px;
  background-color: var(--color-bg-hover);
  color: var(--color-text-secondary);
}
</style>
