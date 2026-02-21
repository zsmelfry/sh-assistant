<template>
  <Teleport to="body">
    <div class="pickerOverlay" @click.self="$emit('close')">
      <div class="pickerPanel">
        <div class="pickerHeader">
          <h3 class="pickerTitle">选择关联文章</h3>
          <button class="closeBtn" @click="$emit('close')">
            <X :size="18" />
          </button>
        </div>

        <!-- Search + tag filter -->
        <div class="filterBar">
          <input
            v-model="searchQuery"
            class="searchInput"
            type="text"
            placeholder="搜索文章标题..."
          />
          <select v-if="tags.length > 0" v-model="selectedTag" class="tagSelect">
            <option value="">全部标签</option>
            <option v-for="tag in tags" :key="tag.id" :value="tag.id">
              {{ tag.name }}
            </option>
          </select>
        </div>

        <!-- Article list -->
        <div class="articleListScroll">
          <div v-if="loading" class="loadingState">加载中...</div>
          <div v-else-if="filteredBookmarks.length === 0" class="emptyState">
            暂无匹配文章
          </div>
          <template v-else>
            <label
              v-for="bm in filteredBookmarks"
              :key="bm.id"
              class="bookmarkItem"
              :class="{ disabled: existingIds.has(bm.id) }"
            >
              <input
                type="checkbox"
                :checked="selected.has(bm.id) || existingIds.has(bm.id)"
                :disabled="existingIds.has(bm.id)"
                class="checkbox"
                @change="toggleSelect(bm.id)"
              />
              <div class="bookmarkInfo">
                <span class="bookmarkTitle">{{ bm.title }}</span>
                <span class="bookmarkMeta">
                  {{ bm.siteName || bm.url }}
                  <template v-if="existingIds.has(bm.id)"> · 已关联</template>
                </span>
              </div>
            </label>
          </template>
        </div>

        <!-- Actions -->
        <div class="pickerActions">
          <span class="selectedCount">已选 {{ selected.size }} 篇</span>
          <div class="actionBtns">
            <button class="actionBtn cancel" @click="$emit('close')">取消</button>
            <button
              class="actionBtn confirm"
              :disabled="selected.size === 0"
              @click="handleConfirm"
            >
              确认关联
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { X } from 'lucide-vue-next';

const props = defineProps<{
  pointId: number;
  existingIds: Set<number>;
}>();

const emit = defineEmits<{
  close: [];
  confirm: [articleIds: number[]];
}>();

interface BookmarkItem {
  id: number;
  title: string;
  url: string;
  siteName: string | null;
  tags: { id: number; name: string }[];
}

interface TagItem {
  id: number;
  name: string;
}

const searchQuery = ref('');
const selectedTag = ref('');
const selected = ref<Set<number>>(new Set());
const loading = ref(false);
const bookmarks = ref<BookmarkItem[]>([]);
const tags = ref<TagItem[]>([]);

// Load bookmarks and tags on mount
onMounted(async () => {
  loading.value = true;
  try {
    const [bmRes, tagRes] = await Promise.all([
      $fetch<{ bookmarks: BookmarkItem[] }>('/api/bookmarks', { params: { limit: 200 } }),
      $fetch<TagItem[]>('/api/article-tags'),
    ]);
    bookmarks.value = bmRes.bookmarks;
    tags.value = tagRes;
  } catch {
    bookmarks.value = [];
  } finally {
    loading.value = false;
  }
});

const filteredBookmarks = computed(() => {
  let result = bookmarks.value;

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase();
    result = result.filter(b => b.title.toLowerCase().includes(q));
  }

  if (selectedTag.value) {
    const tagId = Number(selectedTag.value);
    result = result.filter(b => b.tags.some(t => t.id === tagId));
  }

  return result;
});

function toggleSelect(articleId: number) {
  const next = new Set(selected.value);
  if (next.has(articleId)) {
    next.delete(articleId);
  } else {
    next.add(articleId);
  }
  selected.value = next;
}

function handleConfirm() {
  emit('confirm', Array.from(selected.value));
}
</script>

<style scoped>
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
  max-width: 600px;
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

/* Filter bar */
.filterBar {
  display: flex;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  border-bottom: 1px solid var(--color-border);
}

.searchInput {
  flex: 1;
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

.tagSelect {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  cursor: pointer;
}

/* Article list */
.articleListScroll {
  flex: 1;
  overflow-y: auto;
  min-height: 200px;
  max-height: 400px;
}

.loadingState,
.emptyState {
  text-align: center;
  padding: var(--spacing-xl);
  font-size: 13px;
  color: var(--color-text-secondary);
}

.bookmarkItem {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  cursor: pointer;
  transition: background-color var(--transition-fast);
}

.bookmarkItem:hover {
  background: var(--color-bg-hover);
}

.bookmarkItem:not(:last-child) {
  border-bottom: 1px solid var(--color-border);
}

.bookmarkItem.disabled {
  opacity: 0.5;
  cursor: default;
}

.checkbox {
  flex-shrink: 0;
  margin-top: 2px;
  accent-color: var(--color-accent);
}

.bookmarkInfo {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.bookmarkTitle {
  font-size: 14px;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bookmarkMeta {
  font-size: 12px;
  color: var(--color-text-secondary);
}

/* Actions */
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
  transition: all var(--transition-fast);
}

.actionBtn.confirm {
  border: 1px solid var(--color-accent);
  background: var(--color-accent);
  color: var(--color-accent-inverse);
}

.actionBtn.confirm:hover:not(:disabled) {
  opacity: 0.85;
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

.actionBtn.cancel:hover {
  background: var(--color-bg-hover);
}

@media (max-width: 768px) {
  .pickerPanel {
    width: 100%;
    height: 100%;
    max-width: none;
    max-height: none;
    border-radius: 0;
  }

  .filterBar {
    flex-direction: column;
  }

  .actionBtn {
    min-height: var(--touch-target-min);
  }
}
</style>
