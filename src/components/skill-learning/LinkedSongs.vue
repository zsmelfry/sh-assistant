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
            <div class="songMain">
              <div class="songRow">
                <div class="songInfo">
                  <span class="songTitle">{{ song.title }}</span>
                  <span class="songMeta">
                    {{ song.artist }}
                    <template v-if="song.year"> · {{ song.year }}</template>
                  </span>
                </div>
                <div class="songActions">
                  <button
                    v-if="song.melody"
                    class="iconBtn"
                    title="演奏旋律"
                    @click="openPlayer(song)"
                  >
                    <Play :size="14" />
                  </button>
                  <button
                    class="iconBtn"
                    title="导入简谱"
                    @click="toggleImportSheet(song.songId)"
                  >
                    <FileText :size="14" />
                  </button>
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
              </div>

              <!-- Sheet music preview -->
              <pre v-if="song.sheetMusic && importSheetSongId !== song.songId" class="sheetPreview">{{ song.sheetMusic }}</pre>

              <!-- Import sheet music form -->
              <div v-if="importSheetSongId === song.songId" class="importSheetForm">
                <textarea
                  v-model="importSheetText"
                  class="editInput sheetTextarea"
                  placeholder="粘贴简谱，如：1 2 3 1 | 1 2 3 1 | 3 4 5 - | 3 4 5 -"
                  rows="4"
                />
                <div class="editActions">
                  <button
                    class="editActionBtn save"
                    :disabled="!importSheetText.trim() || importingSheet"
                    @click="handleImportSheet(song.songId)"
                  >
                    {{ importingSheet ? '保存中...' : '保存' }}
                  </button>
                  <button class="editActionBtn cancel" @click="importSheetSongId = null">取消</button>
                  <button class="editActionBtn promptToggle" @click="showPrompt = !showPrompt">
                    {{ showPrompt ? '收起格式说明' : '格式说明' }}
                  </button>
                </div>

                <!-- Prompt reference -->
                <div v-if="showPrompt" class="promptBlock">
                  <div class="promptHeader">
                    <span class="promptLabel">简谱识别 Prompt（复制后配合 AI + 简谱图片使用）</span>
                    <button class="copyBtn" @click="handleCopyPrompt">{{ promptCopied ? '已复制' : '复制' }}</button>
                  </div>
                  <pre class="promptContent">{{ JIANPU_PROMPT }}</pre>
                </div>
              </div>
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

    <!-- Melody player modal -->
    <MelodyPlayerModal
      v-if="playerSong"
      :title="playerSong.title"
      :artist="playerSong.artist"
      :melody="playerSong.melody!"
      :sheet-music="playerSong.sheetMusic"
      @close="playerSong = null"
    />
  </div>
</template>

<script setup lang="ts">
import { X, ChevronRight, ExternalLink, Pencil, Play, FileText } from 'lucide-vue-next';
import { SKILL_STORE_KEY } from '~/composables/skill-learning';
import type { LinkedSong } from '~/composables/skill-learning/types';
import { parseJianpu } from '~/utils/jianpu-parser';
import SongPicker from './SongPicker.vue';
import MelodyPlayerModal from './MelodyPlayerModal.vue';

const props = defineProps<{
  pointId: number;
}>();

const store = inject(SKILL_STORE_KEY)!;
const collapsed = ref(true);
const showPicker = ref(false);

// Melody player modal
const playerSong = ref<LinkedSong | null>(null);

function openPlayer(song: LinkedSong) {
  if (song.melody) {
    playerSong.value = song;
  }
}

// Import sheet music
const importSheetSongId = ref<number | null>(null);
const importSheetText = ref('');
const importingSheet = ref(false);
const showPrompt = ref(false);
const promptCopied = ref(false);

const JIANPU_PROMPT = `你是专业简谱转录员。将图片中的简谱精确转换为文本格式，直接输出结果，不加解释。

# 输出格式

头部各占一行：
BPM=78        ← 从谱面 ♩=78 或速度标记读取
KEY=Bb        ← 从谱面 1=Bb 读取（支持 C D E F G A Bb Eb Ab 等）

之后每行一个乐句，| 分隔小节。不输出歌词、和弦、注释。

# 语法速查

## 音高
  1-7       中音区
  1'-7'     高八度（数字正上方有圆点）
  1,-7,     低八度（数字正下方有圆点）
  4#  7b    升/降半音

## 时值——核心规则：每个空格分隔的 token = 1拍
  3         四分音符（1拍）
  3 -       二分音符（2拍，- 延长前音1拍）
  3 - - -   全音符（4拍）
  0         休止符（1拍）
  6.        附点四分（1.5拍，. 紧跟数字无空格）
  |         小节线（不占时间）

## 括号——每个括号 = 1拍，内含 2~4 个音
  (32)      2个八分音符（各1/2拍）
  (3.2)     附点八分+十六分（3/4拍+1/4拍）—— . 跟在第一个音后
  (234)     十六+十六+八分（1/4+1/4+1/2拍）—— 3音混合节奏，极常见！
  (5323)    4个十六分（各1/4拍）
  (05)      组内休止+八分
  (32) .    附点组（整组1.5拍，. 与括号间有空格）

## 连音线
  同音弧线 = 合并为长音：5 ⌒ 5 → 写 5 -

# 三大易错点（按严重程度排序）

## 1. 漏标高低音点 → 音高全错
简谱中数字上方/下方的小圆点决定八度，**这是最容易漏掉的标记**。
- 数字正上方有小圆点 → 高音，写 ' （如 1' 5' 6'）
- 数字正下方有小圆点 → 低音，写 , （如 7, 6, 5,）
- 无圆点 → 中音，不加标记

识别技巧：
- 高低音点通常比附点更小、更圆，位于数字正上方或正下方的中心位置
- 附点在数字右侧偏下
- 下方的高低音点容易与 beam 横线混淆——beam 是连接多个音的长横线，高低音点是孤立的小圆点
- **主歌**旋律通常在中低音区，7、6、5 常需要低音标记（7, 6, 5,）
- **副歌**旋律通常升高，但 7 仍常为低音（因为在大调中 7 的音名低于 1 的音名）
- 如果连续出现 1→7 或 1→6 的下行，7 和 6 几乎一定是低音（7, 6,）

## 2. 附点八分写成均分八分 → 节奏失去律动
两个 beamed 音符中，第一个右侧/下方有小圆点 → 附点节奏，不是均分！
- ✅ (3.2) = 附点八分+十六分（长~短，3/4+1/4拍）
- ❌ (32) = 两个均分八分（哒哒，各1/2拍）
慢歌前奏/间奏常大量使用连续附点：(3.2) (2.1) (1.7,) (7,.6,)

## 3. 3音混合节奏拆成 2+1 → 多出1拍
3个音共享 beam 组（前2个双横线 + 后1个单横线）→ 必须放入同一括号！
- ✅ (234) = 1拍
- ❌ (23) 4 = 2拍，节奏错乱

# 其他规则
- 括号内最多4个音，≥5个必须按 beam 分组拆成多个括号
- 高音1写 1'，不写 i（OCR 常误识别）
- 括号内的 . 一律是附点，不是高音点；高音必须用 '
- 4/4拍每小节必须凑满4拍（裸数字=1拍，括号=1拍，-=1拍，0=1拍，X.=1.5拍）

# 转录流程

1. **读取元信息**：速度（BPM）、调号（KEY）、拍号
2. **确定声部**：只转录主旋律（带歌词的数字行），忽略和弦、伴奏、鼓点
3. **逐小节转录**，对每个音符检查：
   a. 数字（1-7 或 0）
   b. 上方/下方有无圆点 → 高音 ' 或低音 ,
   c. 下方 beam 横线数 → 决定括号分组
   d. 有无附点 .（紧跟数字右侧的小圆点）
   e. 有无延音线 → 写 -
4. **逐小节验拍**：数 token 总拍数 = 拍号规定拍数
5. **全曲自检**：
   - 逐小节确认拍数正确
   - 检查器乐段落（前奏/间奏）的附点节奏是否遗漏
   - 检查主歌中 7、6、5 是否正确标注了低音 ,
   - 哼唱副歌验证旋律走向`;

function handleCopyPrompt() {
  navigator.clipboard.writeText(JIANPU_PROMPT);
  promptCopied.value = true;
  setTimeout(() => { promptCopied.value = false; }, 2000);
}

function toggleImportSheet(songId: number) {
  if (importSheetSongId.value === songId) {
    importSheetSongId.value = null;
  } else {
    importSheetSongId.value = songId;
    // Pre-fill with existing sheet music if available
    const song = store.linkedSongs.find(s => s.songId === songId);
    importSheetText.value = song?.sheetMusic || '';
  }
}

async function handleImportSheet(songId: number) {
  const text = importSheetText.value.trim();
  if (!text) return;

  const { melody } = parseJianpu(text);
  if (melody.length === 0) {
    alert('简谱解析结果为空，请检查格式');
    return;
  }

  importingSheet.value = true;
  try {
    await $fetch(`/api/songs/${songId}`, {
      method: 'PATCH',
      body: {
        sheetMusic: text,
        notes: JSON.stringify(melody),
      },
    });
    const idx = store.linkedSongs.findIndex(s => s.songId === songId);
    if (idx >= 0) {
      const updated = [...store.linkedSongs];
      updated[idx] = { ...updated[idx], melody, sheetMusic: text };
      store.linkedSongs = updated;
    }
    importSheetSongId.value = null;
  } catch (e: unknown) {
    alert(extractErrorMessage(e, '简谱保存失败'));
  } finally {
    importingSheet.value = false;
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
  flex-direction: column;
  padding: var(--spacing-sm) var(--spacing-md);
}

.songMain {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.songRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
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

/* Sheet music preview */
.sheetPreview {
  margin: 4px 0 0;
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-secondary, var(--color-bg-primary));
  font-family: monospace;
  font-size: 12px;
  line-height: 1.6;
  color: var(--color-text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 120px;
  overflow-y: auto;
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

.importSheetForm {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  padding-top: var(--spacing-xs);
}

.sheetTextarea {
  resize: vertical;
  min-height: 80px;
  font-family: monospace;
  font-size: 13px;
  line-height: 1.4;
}

.promptToggle {
  border: 1px solid var(--color-border);
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
  margin-left: auto;
}

.promptBlock {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-secondary, var(--color-bg-primary));
  overflow: hidden;
}

.promptHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-xs) var(--spacing-sm);
  border-bottom: 1px solid var(--color-border);
}

.promptLabel {
  font-size: 12px;
  color: var(--color-text-secondary);
  font-weight: 500;
}

.copyBtn {
  padding: 2px var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
  font-size: 11px;
  cursor: pointer;
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.copyBtn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.promptContent {
  padding: var(--spacing-sm);
  margin: 0;
  font-size: 12px;
  font-family: monospace;
  line-height: 1.5;
  color: var(--color-text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 400px;
  overflow-y: auto;
  user-select: text;
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
