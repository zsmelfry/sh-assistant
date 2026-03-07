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

const JIANPU_PROMPT = `你是一个简谱 OCR 专家。请将图片中的简谱精确转换为以下文本格式。

重要：你的准确度直接决定播放是否正确。每个音符、每个节奏都必须和原谱完全一致。

## 输出格式

### 头部（各占一行）
BPM=54
KEY=G

- BPM：从谱面读取速度标记（如 ♩=54 → BPM=54）
- KEY：从谱面读取调号（如 "1=G" → KEY=G）。常见调号：C D E F G A Bb Eb Ab 等。如果谱面写 "1=bB" 或 "1=Bb" 则 KEY=Bb

### 核心规则：每个空格分隔的 token = 1拍

#### 音高标记
  1-7         中音
  1'-7'       高音（原谱中数字上方有1个点）
  1''-7''     倍高音（上方2个点）
  1,-7,       低音（数字下方有1个点）
  1,,-7,,     倍低音（下方2个点）
  4#          升半音
  7b          降半音

#### 节奏标记（极其重要！）

简谱中用数字下方的横线（也叫减时线/beam）表示音符时值缩短：
- 无横线 = 四分音符 = 1拍 → 直接写数字：3
- 1条横线 = 八分音符 = 半拍 → 2个一组放括号：(32)
- 2条横线 = 十六分音符 = 1/4拍 → 4个一组放括号：(5323)

⚠️ 括号内只允许 2个 或 4个 音符！
- 2个音 = 两个八分音符共享1拍：(32)
- 4个音 = 四个十六分音符共享1拍：(5323)

⚠️ 严禁3个音、5个音、6个音放在同一个括号内！

混合节奏的正确处理（极常见）：
- 十六分+十六分+八分 = 1拍 → 写成3个音的括号：(1'1'6)  ← 系统会自动处理为1/4+1/4+1/2拍
- 八分+十六分+十六分 = 1拍 → 也写成3个音的括号：(61'1')

⚠️ 跨拍的情况不要合并到一个括号！
错误：(235232) ← 6个音不可能在1拍内
正确：拆分为 (23) (52) (32) 或 (2352) (32) 等，确保每个括号 ≤ 4个音

附点音符（数字后面紧跟小圆点）：
  6.          附点四分音符 = 1.5拍（直接写 6. 即可）
  (32) .      附点组 = 1.5拍

其他时值：
  -           延长前一个音1拍
  0           休止1拍
  (0x)        括号内的 0 = 组内休止

#### 连音线（弧线/tie）
简谱中两个相同音符之间的弧线表示连音，把两个音合并为一个长音。
例：3 ⌒ 3 = 两拍的 3，写作：3 -
例：(32) ⌒ 2 = 半拍3+1.5拍2，但简化写：(32) -（延长整组最后一个音）

#### 小节线
  |           小节线（不占时间）

## 识别步骤（请严格按顺序执行）

### 第1步：读取元信息
- 找到速度标记（♩= 或 BPM）→ 写 BPM=数字
- 找到调号标记（1=X）→ 写 KEY=X

### 第2步：确定只转录主旋律
- 只转录歌曲的主旋律声部（通常是带歌词的那行数字）
- 忽略：和弦标记（Am, G7 等）、吉他指法图、贝斯线、前奏/间奏/尾奏的伴奏声部、鼓点标记
- 如果有前奏标记但也是旋律性质的（如筝、笛子 solo），可以包含

### 第3步：逐小节转录
对每个小节：
1. 数清楚小节内有几拍（通常4拍）
2. 逐个音符读取：
   a. 数字是什么（1-7, 0）
   b. 上方或下方有没有点（高音 ' 或低音 ,）
   c. 下方有几条横线（决定放几个音在括号里）
   d. 有没有延音线 -
   e. 有没有附点 .
3. 验证：括号内的音符数 × 每个音符时值 = 1拍

### 第4步：自检
转录完成后，选取你最熟悉的段落（通常是副歌），在脑中哼唱一遍验证旋律是否正确。

## 完整示例

假设原谱标注 ♩=120, 1=C, 4/4拍。谱面内容：

小节1：1 2 3 1（四个四分音符，无横线）
小节2：3 4 5 -（5 后面有横线连到下一拍）
小节3：五线下方有横线的 5 6 5 4 3 1（前4个十六分音符+后2个八分音符）

输出：
BPM=120
KEY=C
1 2 3 1 | 3 4 5 - | (5654) (31) |

解读最后一小节：
- 5654 四个十六分音符 → (5654) 占1拍
- 31 两个八分音符 → (31) 占1拍
- 合计2拍，但原谱是4/4应该4拍 → 说明可能还有其他音符。这只是示意。

## 常见错误（必须避免）

1. ❌ 把十六分音符（4个一组）拆成两组八分音符
   原谱：5323（4个音共享2条横线）
   错误：(53) (23)  ← 这变成了2拍！
   正确：(5323)  ← 这是1拍

2. ❌ 把数字1的高音点误写成字母 i
   原谱：1上方有点（高音do）看起来像 i
   错误：(2i6) ← i 不是合法字符！
   正确：(21'6)
   ⚠️ 所有高音1必须写成 1'，绝对不能写 i

3. ❌ 忽略高低音点
   原谱：1上方有点 → 1'（高音）
   原谱：6下方有点 → 6,（低音）

4. ❌ 把太多音塞进一个括号
   错误：(235232) ← 6个音在1拍？不可能
   正确：(2352) (32) ← 分成1拍+半拍（具体看原谱横线分组）
   错误：(16165) ← 5个音
   正确：(1616) 5 或 (16) (16) 5 ← 看原谱横线怎么分

5. ❌ 附点写法错误
   错误：6 .（空格分开）或 6. 5（连在一起没空格）
   正确：6. 5（附点紧跟数字，后面空格分隔下一个音）

6. ❌ 把连音线当成不同的音
   原谱：5 ⌒ 5（同音连线，表示延长）
   错误：5 5
   正确：5 -

7. ❌ 搞错拍数
   4/4拍每小节必须凑满4拍。数一数你每个小节的总拍数。
   每个裸数字 = 1拍，每个括号 = 1拍，- = 1拍，0 = 1拍

## 输出要求

1. 第一行 BPM=数字
2. 第二行 KEY=字母
3. 之后每行一个乐句，用 | 分隔小节
4. 不要输出歌词、和弦、注释、解读
5. 不要遗漏任何音符，不要编造不存在的音符`;

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
