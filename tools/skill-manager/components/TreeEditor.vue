<template>
  <div class="treeEditor">
    <div v-if="domains.length === 0" class="emptyState">
      暂无知识树数据，请点击「AI 生成知识树」
    </div>

    <div v-else class="tree">
      <div v-for="(domain, di) in domains" :key="di" class="domainNode">
        <div class="nodeHeader domain">
          <div class="nodeInfo">
            <span class="nodeLabel">领域</span>
            <input
              :value="domain.name"
              class="nodeInput"
              placeholder="领域名称"
              @input="updateDomain(di, 'name', ($event.target as HTMLInputElement).value)"
            />
          </div>
          <button type="button" class="removeBtn" title="删除领域" @click="removeDomain(di)">
            <X :size="14" />
          </button>
        </div>
        <input
          :value="domain.description"
          class="descInput"
          placeholder="领域描述"
          @input="updateDomain(di, 'description', ($event.target as HTMLInputElement).value)"
        />

        <div v-for="(topic, ti) in domain.topics" :key="ti" class="topicNode">
          <div class="nodeHeader topic">
            <div class="nodeInfo">
              <span class="nodeLabel">主题</span>
              <input
                :value="topic.name"
                class="nodeInput"
                placeholder="主题名称"
                @input="updateTopic(di, ti, 'name', ($event.target as HTMLInputElement).value)"
              />
            </div>
            <button type="button" class="removeBtn" title="删除主题" @click="removeTopic(di, ti)">
              <X :size="14" />
            </button>
          </div>

          <div v-for="(point, pi) in topic.points" :key="pi" class="pointNode">
            <div class="nodeHeader point">
              <input
                :value="point.name"
                class="nodeInput small"
                placeholder="知识点名称"
                @input="updatePoint(di, ti, pi, 'name', ($event.target as HTMLInputElement).value)"
              />
              <button type="button" class="removeBtn" title="删除知识点" @click="removePoint(di, ti, pi)">
                <X :size="12" />
              </button>
            </div>
          </div>

          <button type="button" class="addBtn" @click="addPoint(di, ti)">+ 知识点</button>
        </div>

        <button type="button" class="addBtn" @click="addTopic(di)">+ 主题</button>
      </div>

      <button type="button" class="addBtn addDomain" @click="addDomain">+ 领域</button>
    </div>

    <!-- Stats -->
    <div v-if="domains.length > 0" class="stats">
      {{ domains.length }} 个领域，{{ topicCount }} 个主题，{{ pointCount }} 个知识点
    </div>
  </div>
</template>

<script setup lang="ts">
import { X } from 'lucide-vue-next';
import type { GeneratedDomain } from '../types';

const props = defineProps<{
  modelValue: GeneratedDomain[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: GeneratedDomain[]];
}>();

const domains = computed(() => props.modelValue);

const topicCount = computed(() =>
  domains.value.reduce((sum, d) => sum + d.topics.length, 0),
);

const pointCount = computed(() =>
  domains.value.reduce((sum, d) =>
    sum + d.topics.reduce((ts, t) => ts + t.points.length, 0), 0),
);

function clone(): GeneratedDomain[] {
  return JSON.parse(JSON.stringify(domains.value));
}

function updateDomain(di: number, field: 'name' | 'description', value: string) {
  const next = clone();
  next[di][field] = value;
  emit('update:modelValue', next);
}

function removeDomain(di: number) {
  const next = clone();
  next.splice(di, 1);
  emit('update:modelValue', next);
}

function addDomain() {
  const next = clone();
  next.push({ name: '', description: '', topics: [{ name: '', description: '', points: [{ name: '', description: '' }] }] });
  emit('update:modelValue', next);
}

function updateTopic(di: number, ti: number, field: 'name' | 'description', value: string) {
  const next = clone();
  next[di].topics[ti][field] = value;
  emit('update:modelValue', next);
}

function removeTopic(di: number, ti: number) {
  const next = clone();
  next[di].topics.splice(ti, 1);
  emit('update:modelValue', next);
}

function addTopic(di: number) {
  const next = clone();
  next[di].topics.push({ name: '', description: '', points: [{ name: '', description: '' }] });
  emit('update:modelValue', next);
}

function updatePoint(di: number, ti: number, pi: number, field: 'name' | 'description', value: string) {
  const next = clone();
  next[di].topics[ti].points[pi][field] = value;
  emit('update:modelValue', next);
}

function removePoint(di: number, ti: number, pi: number) {
  const next = clone();
  next[di].topics[ti].points.splice(pi, 1);
  emit('update:modelValue', next);
}

function addPoint(di: number, ti: number) {
  const next = clone();
  next[di].topics[ti].points.push({ name: '', description: '' });
  emit('update:modelValue', next);
}
</script>

<style scoped>
.treeEditor {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.emptyState {
  text-align: center;
  padding: var(--spacing-xl);
  color: var(--color-text-secondary);
  font-size: 14px;
}

.tree {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  max-height: 400px;
  overflow-y: auto;
  padding-right: var(--spacing-xs);
}

.domainNode {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-sm);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.topicNode {
  margin-left: var(--spacing-md);
  padding-left: var(--spacing-sm);
  border-left: 2px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.pointNode {
  margin-left: var(--spacing-md);
}

.nodeHeader {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.nodeInfo {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  flex: 1;
  min-width: 0;
}

.nodeLabel {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-secondary);
  white-space: nowrap;
  min-width: 28px;
}

.nodeInput {
  flex: 1;
  min-width: 0;
  padding: 2px var(--spacing-xs);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
  background: transparent;
  font-family: inherit;
}

.nodeInput:focus {
  border-color: var(--color-border);
  background: var(--color-bg-primary);
  outline: none;
}

.nodeInput.small {
  font-size: 12px;
  font-weight: 400;
}

.descInput {
  padding: 2px var(--spacing-xs);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--color-text-secondary);
  background: transparent;
  font-family: inherit;
}

.descInput:focus {
  border-color: var(--color-border);
  background: var(--color-bg-primary);
  outline: none;
}

.removeBtn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-disabled);
  cursor: pointer;
}

.removeBtn:hover {
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

.addBtn {
  background: none;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--spacing-xs) var(--spacing-sm);
  font-size: 12px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.addBtn:hover {
  border-color: var(--color-text-secondary);
  color: var(--color-text-primary);
}

.addDomain {
  align-self: flex-start;
}

.stats {
  font-size: 12px;
  color: var(--color-text-secondary);
  text-align: right;
}
</style>
