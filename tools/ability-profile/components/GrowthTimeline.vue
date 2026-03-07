<template>
  <div class="growth-timeline">
    <h3 class="section-title">成长时间线</h3>

    <div v-if="loading && groups.length === 0" class="loading-hint">加载中...</div>

    <div v-else-if="groups.length === 0" class="empty-hint">暂无活动记录。</div>

    <template v-else>
      <div v-for="group in groups" :key="group.date" class="date-group">
        <div class="date-label">{{ formatDate(group.date) }}</div>
        <div class="entries">
          <div v-for="entry in group.entries" :key="entry.id || entry.time" class="entry">
            <div class="entry-time">{{ formatTime(entry.createdAt) }}</div>
            <div class="entry-body">
              <span class="entry-desc">{{ entry.description }}</span>
              <span v-if="entry.source" class="entry-badge">{{ entry.source }}</span>
              <span v-if="entry.skillName" class="entry-skill">{{ entry.skillName }}</span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="hasMore" class="load-more">
        <BaseButton variant="ghost" :disabled="loading" @click="loadMore">
          {{ loading ? '加载中...' : '加载更多' }}
        </BaseButton>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useAbilityStore } from '~/stores/ability';

const store = useAbilityStore();

const activities = ref<any[]>([]);
const total = ref(0);
const loading = ref(false);
const page = ref(0);
const pageSize = 20;

const hasMore = computed(() => activities.value.length < total.value);

interface DateGroup {
  date: string;
  entries: any[];
}

const groups = computed<DateGroup[]>(() => {
  const map = new Map<string, any[]>();
  for (const a of activities.value) {
    const date = new Date(a.createdAt).toISOString().slice(0, 10);
    if (!map.has(date)) map.set(date, []);
    map.get(date)!.push(a);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, entries]) => ({ date, entries }));
});

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

async function fetchActivities() {
  loading.value = true;
  try {
    const result = await store.loadActivities({
      from: undefined,
      to: undefined,
    });
    activities.value = result.activities.slice(0, (page.value + 1) * pageSize);
    total.value = result.total;
  } finally {
    loading.value = false;
  }
}

async function loadMore() {
  page.value++;
  await fetchActivities();
}

onMounted(() => {
  fetchActivities();
});
</script>

<style scoped>
.growth-timeline {
  margin-top: var(--spacing-lg);
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-md);
}

.loading-hint,
.empty-hint {
  font-size: 13px;
  color: var(--color-text-secondary);
  padding: var(--spacing-lg);
  text-align: center;
}

.date-group {
  margin-bottom: var(--spacing-md);
}

.date-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-sm);
  padding-bottom: var(--spacing-xs);
  border-bottom: 1px solid var(--color-border);
}

.entries {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.entry {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) 0;
}

.entry-time {
  font-size: 12px;
  color: var(--color-text-secondary);
  flex-shrink: 0;
  width: 40px;
}

.entry-body {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
  flex: 1;
}

.entry-desc {
  font-size: 13px;
  color: var(--color-text-primary);
}

.entry-badge {
  font-size: 11px;
  padding: 1px var(--spacing-xs);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  background-color: var(--color-bg-hover);
}

.entry-skill {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.load-more {
  text-align: center;
  padding: var(--spacing-md) 0;
}
</style>
