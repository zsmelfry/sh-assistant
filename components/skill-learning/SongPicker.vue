<template>
  <Teleport to="body">
    <div class="pickerOverlay" @click.self="$emit('close')">
      <div class="pickerPanel">
        <div class="pickerHeader">
          <h3 class="pickerTitle">选择关联歌曲</h3>
          <button class="closeBtn" @click="$emit('close')">
            <X :size="18" />
          </button>
        </div>

        <!-- Quick add form -->
        <div class="quickAdd">
          <div class="quickAddTitle">快速添加歌曲</div>
          <div class="quickAddForm">
            <input v-model="newTitle" class="formInput" placeholder="歌曲名称 *" />
            <input v-model="newArtist" class="formInput" placeholder="歌手 *" />
            <input v-model="newYear" class="formInput shortInput" type="number" placeholder="年份" />
            <input v-model="newYoutubeUrl" class="formInput" placeholder="YouTube链接 (选填)" />
            <button class="quickAddBtn" :disabled="!newTitle.trim() || !newArtist.trim() || adding" @click="handleQuickAdd">
              {{ adding ? '添加中...' : '添加' }}
            </button>
          </div>
        </div>

        <!-- Search filter -->
        <div class="filterBar">
          <input
            v-model="searchQuery"
            class="searchInput"
            type="text"
            placeholder="搜索歌曲..."
          />
        </div>

        <!-- Song list -->
        <div class="songListScroll">
          <div v-if="loading" class="loadingState">加载中...</div>
          <div v-else-if="filteredSongs.length === 0" class="emptyState">
            暂无匹配歌曲
          </div>
          <template v-else>
            <label
              v-for="song in filteredSongs"
              :key="song.id"
              class="songItem"
              :class="{ disabled: existingIds.has(song.id) }"
            >
              <input
                type="checkbox"
                :checked="selected.has(song.id) || existingIds.has(song.id)"
                :disabled="existingIds.has(song.id)"
                class="checkbox"
                @change="toggleSelect(song.id)"
              />
              <div class="songInfo">
                <span class="songTitle">{{ song.title }}</span>
                <span class="songMeta">
                  {{ song.artist }}
                  <template v-if="song.year"> · {{ song.year }}</template>
                  <template v-if="existingIds.has(song.id)"> · 已关联</template>
                </span>
              </div>
            </label>
          </template>
        </div>

        <!-- Actions -->
        <div class="pickerActions">
          <span class="selectedCount">已选 {{ selected.size }} 首</span>
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
  confirm: [songIds: number[]];
}>();

interface SongItem {
  id: number;
  title: string;
  artist: string;
  year: number | null;
  youtubeUrl: string | null;
}

const searchQuery = ref('');
const selected = ref<Set<number>>(new Set());
const loading = ref(false);
const allSongs = ref<SongItem[]>([]);

// Quick add form
const newTitle = ref('');
const newArtist = ref('');
const newYear = ref('');
const newYoutubeUrl = ref('');
const adding = ref(false);

onMounted(async () => {
  loading.value = true;
  try {
    allSongs.value = await $fetch<SongItem[]>('/api/songs');
  } catch {
    allSongs.value = [];
  } finally {
    loading.value = false;
  }
});

const filteredSongs = computed(() => {
  if (!searchQuery.value.trim()) return allSongs.value;
  const q = searchQuery.value.trim().toLowerCase();
  return allSongs.value.filter(s =>
    s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q),
  );
});

function toggleSelect(songId: number) {
  const next = new Set(selected.value);
  if (next.has(songId)) {
    next.delete(songId);
  } else {
    next.add(songId);
  }
  selected.value = next;
}

async function handleQuickAdd() {
  if (!newTitle.value.trim() || !newArtist.value.trim() || adding.value) return;

  adding.value = true;
  try {
    const song = await $fetch<SongItem>('/api/songs', {
      method: 'POST',
      body: {
        title: newTitle.value.trim(),
        artist: newArtist.value.trim(),
        year: newYear.value ? Number(newYear.value) : null,
        youtubeUrl: newYoutubeUrl.value.trim() || null,
      },
    });
    allSongs.value = [song, ...allSongs.value];
    // Auto-select the newly created song
    const next = new Set(selected.value);
    next.add(song.id);
    selected.value = next;
    // Clear form
    newTitle.value = '';
    newArtist.value = '';
    newYear.value = '';
    newYoutubeUrl.value = '';
  } finally {
    adding.value = false;
  }
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
  max-height: 85vh;
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

/* Quick add */
.quickAdd {
  padding: var(--spacing-sm) var(--spacing-md);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-sidebar);
}

.quickAddTitle {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-xs);
}

.quickAddForm {
  display: flex;
  gap: var(--spacing-xs);
  flex-wrap: wrap;
}

.formInput {
  flex: 1;
  min-width: 120px;
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-family: inherit;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  outline: none;
}

.formInput:focus {
  border-color: var(--color-accent);
}

.formInput::placeholder {
  color: var(--color-text-disabled);
}

.shortInput {
  max-width: 80px;
  min-width: 60px;
}

.quickAddBtn {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: var(--color-accent-inverse);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
}

.quickAddBtn:hover:not(:disabled) {
  opacity: 0.85;
}

.quickAddBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Filter */
.filterBar {
  padding: var(--spacing-sm) var(--spacing-md);
  border-bottom: 1px solid var(--color-border);
}

.searchInput {
  width: 100%;
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

/* Song list */
.songListScroll {
  flex: 1;
  overflow-y: auto;
  min-height: 150px;
  max-height: 300px;
}

.loadingState,
.emptyState {
  text-align: center;
  padding: var(--spacing-xl);
  font-size: 13px;
  color: var(--color-text-secondary);
}

.songItem {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  cursor: pointer;
  transition: background-color var(--transition-fast);
}

.songItem:hover {
  background: var(--color-bg-hover);
}

.songItem:not(:last-child) {
  border-bottom: 1px solid var(--color-border);
}

.songItem.disabled {
  opacity: 0.5;
  cursor: default;
}

.checkbox {
  flex-shrink: 0;
  margin-top: 2px;
  accent-color: var(--color-accent);
}

.songInfo {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.songTitle {
  font-size: 14px;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.songMeta {
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

  .quickAddForm {
    flex-direction: column;
  }

  .formInput {
    min-width: 0;
  }

  .shortInput {
    max-width: none;
  }

  .actionBtn {
    min-height: var(--touch-target-min);
  }
}
</style>
