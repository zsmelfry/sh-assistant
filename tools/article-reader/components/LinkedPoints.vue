<template>
  <div class="linkedPoints">
    <div class="sectionHeader">
      <h3 class="sectionTitle">关联知识点</h3>
      <button class="addBtn" @click="showPicker = true">添加关联</button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loadingState">加载中...</div>

    <!-- Points list -->
    <div v-else-if="points.length > 0" class="pointList">
      <div
        v-for="point in points"
        :key="point.pointId"
        class="pointItem"
      >
        <div class="pointInfo" @click="goToPoint(point.pointId)">
          <span class="pointName">{{ point.pointName }}</span>
          <span class="pointMeta">{{ point.domainName }} / {{ point.topicName }}</span>
        </div>
        <button
          class="unlinkBtn"
          title="取消关联"
          @click="handleUnlink(point.pointId)"
        >
          <X :size="14" />
        </button>
      </div>
    </div>

    <!-- Empty -->
    <p v-else class="emptyHint">暂无关联知识点</p>

    <!-- Point picker dialog -->
    <Teleport to="body">
      <div v-if="showPicker" class="pickerOverlay" @click.self="showPicker = false">
        <div class="pickerPanel">
          <div class="pickerHeader">
            <h3 class="pickerTitle">选择知识点</h3>
            <button class="closeBtn" @click="showPicker = false">
              <X :size="18" />
            </button>
          </div>

          <input
            v-model="searchQuery"
            class="searchInput"
            type="text"
            placeholder="搜索知识点..."
          />

          <div class="pickerList">
            <div v-if="domainsLoading" class="loadingState">加载中...</div>
            <template v-else>
              <div
                v-for="domain in filteredDomains"
                :key="domain.id"
                class="domainGroup"
              >
                <div class="domainName">{{ domain.name }}</div>
                <label
                  v-for="pt in domain.filteredPoints"
                  :key="pt.id"
                  class="pickItem"
                  :class="{ disabled: existingPointIds.has(pt.id) }"
                >
                  <input
                    type="checkbox"
                    :checked="selectedIds.has(pt.id) || existingPointIds.has(pt.id)"
                    :disabled="existingPointIds.has(pt.id)"
                    class="checkbox"
                    @change="togglePoint(pt.id)"
                  />
                  <div class="pickInfo">
                    <span class="pickName">{{ pt.name }}</span>
                    <span v-if="existingPointIds.has(pt.id)" class="pickMeta">已关联</span>
                  </div>
                </label>
              </div>
            </template>
          </div>

          <div class="pickerActions">
            <span class="selectedCount">已选 {{ selectedIds.size }} 个</span>
            <div class="actionBtns">
              <button class="actionBtn cancel" @click="showPicker = false">取消</button>
              <button
                class="actionBtn confirm"
                :disabled="selectedIds.size === 0"
                @click="handleLink"
              >
                确认关联
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { X } from 'lucide-vue-next';
import type { LinkedPoint } from '~/tools/startup-map/types';

const props = defineProps<{
  articleId: number;
}>();

interface DomainWithPoints {
  id: number;
  name: string;
  topics: Array<{
    id: number;
    points: Array<{ id: number; name: string }>;
  }>;
}

const loading = ref(false);
const points = ref<LinkedPoint[]>([]);
const showPicker = ref(false);
const searchQuery = ref('');
const selectedIds = ref<Set<number>>(new Set());
const allDomains = ref<DomainWithPoints[]>([]);
const domainsLoading = ref(false);

const existingPointIds = computed(() =>
  new Set(points.value.map(p => p.pointId)),
);

// Load linked points
async function loadPoints() {
  loading.value = true;
  try {
    points.value = await $fetch<LinkedPoint[]>(
      `/api/startup-map/articles/${props.articleId}/points`,
    );
  } catch {
    points.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(() => loadPoints());
watch(() => props.articleId, () => loadPoints());

// Load domains for picker
watch(showPicker, async (show) => {
  if (show && allDomains.value.length === 0) {
    domainsLoading.value = true;
    try {
      allDomains.value = await $fetch<DomainWithPoints[]>('/api/startup-map/domains');
    } catch {
      allDomains.value = [];
    } finally {
      domainsLoading.value = false;
    }
  }
  if (show) {
    selectedIds.value = new Set();
    searchQuery.value = '';
  }
});

const filteredDomains = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  return allDomains.value
    .map(domain => {
      const allPoints = domain.topics.flatMap(t => t.points);
      const filteredPoints = q
        ? allPoints.filter(p => p.name.toLowerCase().includes(q))
        : allPoints;
      return { ...domain, filteredPoints };
    })
    .filter(d => d.filteredPoints.length > 0);
});

function togglePoint(pointId: number) {
  const next = new Set(selectedIds.value);
  if (next.has(pointId)) {
    next.delete(pointId);
  } else {
    next.add(pointId);
  }
  selectedIds.value = next;
}

async function handleLink() {
  if (selectedIds.value.size === 0) return;
  showPicker.value = false;
  try {
    await $fetch(`/api/startup-map/articles/${props.articleId}/points`, {
      method: 'POST',
      body: { pointIds: Array.from(selectedIds.value) },
    });
    await loadPoints();
  } catch {
    // Silent
  }
}

async function handleUnlink(pointId: number) {
  const old = points.value;
  points.value = points.value.filter(p => p.pointId !== pointId);
  try {
    await $fetch(`/api/startup-map/articles/${props.articleId}/points/${pointId}`, {
      method: 'DELETE',
    });
  } catch {
    points.value = old;
  }
}

function goToPoint(pointId: number) {
  navigateTo(`/startup-map?pointId=${pointId}`);
}
</script>

<style scoped>
.linkedPoints {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.sectionHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sectionTitle {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.addBtn {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
  font-size: 12px;
  cursor: pointer;
}

.addBtn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.loadingState {
  text-align: center;
  padding: var(--spacing-sm);
  font-size: 13px;
  color: var(--color-text-secondary);
}

.pointList {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.pointItem {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
}

.pointItem:not(:last-child) {
  border-bottom: 1px solid var(--color-border);
}

.pointInfo {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  cursor: pointer;
}

.pointInfo:hover .pointName {
  text-decoration: underline;
}

.pointName {
  font-size: 14px;
  color: var(--color-text-primary);
}

.pointMeta {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.unlinkBtn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-disabled);
  cursor: pointer;
}

.unlinkBtn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.emptyHint {
  font-size: 13px;
  color: var(--color-text-secondary);
  text-align: center;
  padding: var(--spacing-sm);
}

/* Picker modal */
.pickerOverlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.pickerPanel {
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  background: var(--color-bg-primary);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.pickerHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--color-border);
}

.pickerTitle {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.closeBtn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.closeBtn:hover {
  background: var(--color-bg-hover);
}

.searchInput {
  margin: var(--spacing-sm) var(--spacing-md);
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-family: inherit;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  outline: none;
}

.searchInput:focus {
  border-color: var(--color-accent);
}

.searchInput::placeholder {
  color: var(--color-text-disabled);
}

.pickerList {
  flex: 1;
  overflow-y: auto;
  min-height: 200px;
  max-height: 400px;
}

.domainGroup {
  padding: var(--spacing-xs) 0;
}

.domainName {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  padding: var(--spacing-xs) var(--spacing-md);
}

.pickItem {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) var(--spacing-md);
  cursor: pointer;
}

.pickItem:hover {
  background: var(--color-bg-hover);
}

.pickItem.disabled {
  opacity: 0.5;
  cursor: default;
}

.checkbox {
  flex-shrink: 0;
  accent-color: var(--color-accent);
}

.pickInfo {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.pickName {
  font-size: 13px;
  color: var(--color-text-primary);
}

.pickMeta {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.pickerActions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-sm) var(--spacing-md);
  border-top: 1px solid var(--color-border);
}

.selectedCount {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.actionBtns {
  display: flex;
  gap: var(--spacing-sm);
}

.actionBtn {
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.actionBtn.confirm {
  border: 1px solid var(--color-accent);
  background: var(--color-accent);
  color: var(--color-accent-inverse);
}

.actionBtn.confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.actionBtn.cancel {
  border: 1px solid var(--color-border);
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
}

@media (max-width: 768px) {
  .pickerPanel {
    width: 100%;
    height: 100%;
    max-width: none;
    max-height: none;
    border-radius: 0;
  }
}
</style>
