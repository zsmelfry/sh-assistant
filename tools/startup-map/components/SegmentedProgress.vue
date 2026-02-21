<template>
  <div class="segmentedProgress">
    <div class="bar">
      <div
        v-if="practicedPct > 0"
        class="segment practiced"
        :style="{ width: practicedPct + '%' }"
        :title="`已实践 ${practiced}`"
      />
      <div
        v-if="understoodPct > 0"
        class="segment understood"
        :style="{ width: understoodPct + '%' }"
        :title="`已理解 ${understood}`"
      />
      <div
        v-if="learningPct > 0"
        class="segment learning"
        :style="{ width: learningPct + '%' }"
        :title="`学习中 ${learning}`"
      />
      <div
        v-if="notStartedPct > 0"
        class="segment notStarted"
        :style="{ width: notStartedPct + '%' }"
        :title="`未开始 ${notStarted}`"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  notStarted: number;
  learning: number;
  understood: number;
  practiced: number;
  total: number;
}>();

const notStartedPct = computed(() => props.total > 0 ? (props.notStarted / props.total) * 100 : 0);
const learningPct = computed(() => props.total > 0 ? (props.learning / props.total) * 100 : 0);
const understoodPct = computed(() => props.total > 0 ? (props.understood / props.total) * 100 : 0);
const practicedPct = computed(() => props.total > 0 ? (props.practiced / props.total) * 100 : 0);
</script>

<style scoped>
.bar {
  display: flex;
  height: 6px;
  border-radius: 3px;
  overflow: hidden;
  background: var(--color-chart-empty);
}

.segment {
  transition: width 300ms ease;
}

/* Four grey shades: darkest (practiced) → lightest (not started) */
.segment.practiced {
  background: var(--color-text-primary);
}

.segment.understood {
  background: var(--color-text-secondary);
}

.segment.learning {
  background: var(--color-border);
}

.segment.notStarted {
  background: var(--color-chart-empty);
}
</style>
