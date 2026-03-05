<template>
  <div class="linkedSongs">
    <div class="sectionHeader">
      <button class="collapseHeader" @click="collapsed = !collapsed">
        <ChevronRight :size="16" class="chevron" :class="{ expanded: !collapsed }" />
        <h3 class="sectionTitle">关联歌曲</h3>
        <span v-if="store.linkedSongs.length > 0" class="badge">{{ store.linkedSongs.length }}</span>
      </button>
      <button v-if="!collapsed" class="addBtn" @click="showPicker = true">添加关联</button>
    </div>

    <template v-if="!collapsed">
      <!-- Loading -->
      <div v-if="store.linkedSongsLoading" class="loadingState">加载中...</div>

      <!-- Song list -->
      <div v-else-if="store.linkedSongs.length > 0" class="songList">
        <div
          v-for="song in store.linkedSongs"
          :key="song.songId"
          class="songItem"
        >
          <!-- Edit mode -->
          <template v-if="editingSongId === song.songId">
            <div class="editForm">
              <div class="editRow">
                <input v-model="editForm.title" class="editInput" placeholder="歌名" />
                <input v-model="editForm.artist" class="editInput" placeholder="歌手" />
              </div>
              <div class="editRow">
                <input v-model="editForm.year" class="editInput shortInput" type="number" placeholder="年份" />
                <input v-model="editForm.youtubeUrl" class="editInput" placeholder="YouTube链接" />
              </div>
              <div class="editActions">
                <button class="editActionBtn save" :disabled="!editForm.title?.trim() || !editForm.artist?.trim() || editSaving" @click="handleSaveEdit(song.songId)">
                  {{ editSaving ? '保存中...' : '保存' }}
                </button>
                <button class="editActionBtn cancel" @click="editingSongId = null">取消</button>
              </div>
            </div>
          </template>

          <!-- Display mode -->
          <template v-else>
            <div class="songInfo">
              <span class="songTitle">{{ song.title }}</span>
              <span class="songMeta">
                {{ song.artist }}
                <template v-if="song.year"> · {{ song.year }}</template>
              </span>
            </div>
            <div class="songActions">
              <button
                v-if="!song.melody"
                class="iconBtn"
                :class="{ spinning: generatingMelodyId === song.songId }"
                title="生成旋律"
                :disabled="generatingMelodyId === song.songId"
                @click="handleGenerateMelody(song.songId)"
              >
                <Music2 :size="14" />
              </button>
              <template v-else>
                <button
                  class="iconBtn"
                  title="演奏旋律"
                  @click="handlePlayMelody(song)"
                >
                  <Play :size="14" />
                </button>
                <button
                  class="iconBtn"
                  :class="{ spinning: generatingMelodyId === song.songId }"
                  title="重新生成旋律"
                  :disabled="generatingMelodyId === song.songId"
                  @click="handleGenerateMelody(song.songId)"
                >
                  <RefreshCw :size="14" />
                </button>
              </template>
              <a
                v-if="song.youtubeUrl"
                :href="song.youtubeUrl"
                target="_blank"
                rel="noopener"
                class="iconBtn"
                title="YouTube"
              >
                <ExternalLink :size="14" />
              </a>
              <button class="iconBtn" title="编辑" @click="startEdit(song)">
                <Pencil :size="14" />
              </button>
              <button
                class="iconBtn danger"
                title="取消关联"
                @click="handleUnlink(song.songId)"
              >
                <X :size="14" />
              </button>
            </div>
          </template>
        </div>
      </div>

      <!-- Empty -->
      <p v-else class="emptyHint">关联歌曲让学习更有趣</p>
    </template>

    <!-- Song picker modal -->
    <SongPicker
      v-if="showPicker"
      :point-id="pointId"
      :existing-ids="existingSongIds"
      @close="showPicker = false"
      @confirm="handleLink"
    />
  </div>
</template>

<script setup lang="ts">
import { X, ChevronRight, ExternalLink, Pencil, Music2, Play, RefreshCw } from 'lucide-vue-next';
import { SKILL_STORE_KEY } from '~/composables/skill-learning';
import type { LinkedSong, MelodyNote } from '~/composables/skill-learning/types';
import SongPicker from './SongPicker.vue';

const props = defineProps<{
  pointId: number;
}>();

const emit = defineEmits<{
  'play-melody': [melody: MelodyNote[]];
}>();

const store = inject(SKILL_STORE_KEY)!;
const collapsed = ref(true);
const showPicker = ref(false);

// Melody generation
const generatingMelodyId = ref<number | null>(null);

async function handleGenerateMelody(songId: number) {
  generatingMelodyId.value = songId;
  try {
    const res = await $fetch<{ melody: MelodyNote[] }>(`/api/songs/${songId}/melody`, {
      method: 'POST',
    });
    // Update the song in store with the new melody
    const idx = store.linkedSongs.findIndex(s => s.songId === songId);
    if (idx >= 0) {
      const updated = [...store.linkedSongs];
      updated[idx] = { ...updated[idx], melody: res.melody };
      store.linkedSongs = updated;
    }
  } catch (e: unknown) {
    alert(extractErrorMessage(e, '旋律生成失败'));
  } finally {
    generatingMelodyId.value = null;
  }
}

function handlePlayMelody(song: LinkedSong) {
  if (song.melody) {
    emit('play-melody', song.melody);
  }
}

// Edit state
const editingSongId = ref<number | null>(null);
const editSaving = ref(false);
const editForm = reactive({
  title: '',
  artist: '',
  year: '' as string | number,
  youtubeUrl: '',
});

const existingSongIds = computed(() =>
  new Set(store.linkedSongs.map(s => s.songId)),
);

onMounted(() => {
  store.loadPointSongs(props.pointId);
});

watch(() => props.pointId, (id) => {
  editingSongId.value = null;
  store.loadPointSongs(id);
});

function startEdit(song: LinkedSong) {
  editingSongId.value = song.songId;
  editForm.title = song.title;
  editForm.artist = song.artist;
  editForm.year = song.year ?? '';
  editForm.youtubeUrl = song.youtubeUrl ?? '';
}

async function handleSaveEdit(songId: number) {
  if (!editForm.title?.trim() || !editForm.artist?.trim()) return;
  editSaving.value = true;
  try {
    await $fetch(`/api/songs/${songId}`, {
      method: 'PATCH',
      body: {
        title: editForm.title.trim(),
        artist: editForm.artist.trim(),
        year: editForm.year ? Number(editForm.year) : null,
        youtubeUrl: editForm.youtubeUrl?.trim() || null,
      },
    });
    editingSongId.value = null;
    // Reload to get updated data
    await store.loadPointSongs(props.pointId);
  } finally {
    editSaving.value = false;
  }
}

async function handleLink(songIds: number[]) {
  showPicker.value = false;
  await store.linkSongs(props.pointId, songIds);
}

function handleUnlink(songId: number) {
  store.unlinkSong(props.pointId, songId);
}
</script>

<style scoped>
.linkedSongs {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.sectionHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.collapseHeader {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;
}

.chevron {
  transition: transform var(--transition-fast);
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.chevron.expanded {
  transform: rotate(90deg);
}

.sectionTitle {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}

.badge {
  font-size: 11px;
  color: var(--color-text-secondary);
  padding: 1px 6px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.addBtn {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all var(--transition-fast);
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

.songList {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.songItem {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
}

.songItem:not(:last-child) {
  border-bottom: 1px solid var(--color-border);
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

.songActions {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  flex-shrink: 0;
}

.iconBtn {
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
  transition: all var(--transition-fast);
  text-decoration: none;
}

.iconBtn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.iconBtn.danger:hover {
  color: var(--color-danger, var(--color-text-primary));
}

.iconBtn.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Edit form */
.editForm {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.editRow {
  display: flex;
  gap: var(--spacing-xs);
}

.editInput {
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

.editInput:focus {
  border-color: var(--color-accent);
}

.editInput::placeholder {
  color: var(--color-text-disabled);
}

.shortInput {
  max-width: 80px;
}

.editActions {
  display: flex;
  gap: var(--spacing-xs);
}

.editActionBtn {
  padding: 2px var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}

.editActionBtn.save {
  border: 1px solid var(--color-accent);
  background: var(--color-accent);
  color: var(--color-accent-inverse);
}

.editActionBtn.save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.editActionBtn.cancel {
  border: 1px solid var(--color-border);
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
}

.emptyHint {
  font-size: 13px;
  color: var(--color-text-secondary);
  text-align: center;
  padding: var(--spacing-sm);
}

@media (max-width: 768px) {
  .songItem {
    min-height: var(--touch-target-min);
  }

  .editRow {
    flex-direction: column;
  }

  .shortInput {
    max-width: none;
  }
}
</style>
