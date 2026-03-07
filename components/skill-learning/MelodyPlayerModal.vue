<template>
  <Teleport to="body">
    <div class="overlay" @click.self="handleClose">
      <div class="modal">
        <!-- Header -->
        <div class="modalHeader">
          <div class="songMeta">
            <h2 class="songName">{{ title }}</h2>
            <span class="songArtist">{{ artist }}</span>
          </div>
          <button class="closeBtn" @click="handleClose">
            <X :size="18" />
          </button>
        </div>

        <!-- Jianpu score (original format) -->
        <div v-if="sheetMusic" class="scoreSection">
          <div class="scoreLabel">简谱</div>
          <div ref="sheetRef" class="sheetDisplay">
            <template v-for="(token, i) in tokens" :key="i">
              <span v-if="token.type === 'bar'" class="tok bar">|</span>
              <span v-else-if="token.type === 'extend'" class="tok extend" :class="tokenClass(token)">-</span>
              <span v-else-if="token.type === 'dot'" class="tok dot" :class="tokenClass(token)">.</span>
              <span
                v-else-if="token.type === 'rest'"
                class="tok rest"
                :class="tokenClass(token)"
              >0</span>
              <span
                v-else-if="token.type === 'note'"
                class="tok note"
                :class="[tokenClass(token), octaveClass(token)]"
              >
                <span v-if="token.octave && token.octave >= 5" class="octaveDot top">·</span>
                <span v-if="token.octave && token.octave >= 6" class="octaveDot top second">·</span>
                {{ token.degree }}{{ token.accidental || '' }}
                <span v-if="token.octave && token.octave <= 3" class="octaveDot bottom">·</span>
                <span v-if="token.octave && token.octave <= 2" class="octaveDot bottom second">·</span>
              </span>
            </template>
          </div>
        </div>

        <!-- Piano notation -->
        <div class="scoreSection">
          <div class="scoreLabel">钢琴谱</div>
          <div ref="pianoScoreRef" class="pianoScore">
            <div
              v-for="(n, i) in melody"
              :key="i"
              class="pianoNote"
              :class="{ current: currentNoteIndex === i, played: i < currentNoteIndex }"
            >
              {{ formatNote(n.note) }}
            </div>
          </div>
        </div>

        <!-- Keyboard -->
        <div class="keyboardSection">
          <div class="keyboard">
            <div
              v-for="key in keys"
              :key="key.note"
              class="key"
              :class="{
                black: key.isBlack,
                white: !key.isBlack,
                active: activeNotes.has(key.note),
              }"
              @mousedown="playNote(key.note)"
              @touchstart.prevent="playNote(key.note)"
            >
              <span v-if="!key.isBlack" class="keyLabel">{{ key.label }}</span>
            </div>
          </div>
        </div>

        <!-- Controls -->
        <div class="controls">
          <button class="controlBtn primary" :disabled="isPlaying" @click="play">
            {{ isPlaying ? '演奏中...' : '演奏' }}
          </button>
          <button v-if="isPlaying" class="controlBtn" @click="stop">停止</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { X } from 'lucide-vue-next';
import type { MelodyNote } from '~/composables/skill-learning/types';
import { parseJianpu, type JianpuToken } from '~/utils/jianpu-parser';

const props = defineProps<{
  title: string;
  artist: string;
  melody: MelodyNote[];
  sheetMusic: string | null;
}>();

const emit = defineEmits<{ close: [] }>();

// Parse sheet music into tokens for display
const tokens = computed(() => {
  if (!props.sheetMusic) return [];
  return parseJianpu(props.sheetMusic).tokens;
});

// Playback state
const activeNotes = ref<Set<string>>(new Set());
const isPlaying = ref(false);
const currentNoteIndex = ref(-1);
const pianoScoreRef = ref<HTMLElement | null>(null);
let aborted = false;

// Audio
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SOLFEGE: Record<string, string> = {
  C: 'do', D: 're', E: 'mi', F: 'fa', G: 'sol', A: 'la', B: 'si',
};
const NOTE_FREQS: Record<string, number> = {};
for (let oct = 1; oct <= 7; oct++) {
  for (let i = 0; i < 12; i++) {
    const key = `${NOTE_NAMES[i]}${oct}`;
    NOTE_FREQS[key] = 440 * Math.pow(2, ((oct - 4) * 12 + (i - 9)) / 12);
  }
}

// Keyboard keys (octave 2-6 to cover full range)
interface KeyDef { note: string; label: string; isBlack: boolean }
const keys = computed<KeyDef[]>(() => {
  const result: KeyDef[] = [];
  for (let oct = 2; oct <= 6; oct++) {
    for (const name of NOTE_NAMES) {
      const note = `${name}${oct}`;
      const isBlack = name.includes('#');
      const base = name.replace('#', '');
      result.push({ note, label: isBlack ? '' : `${SOLFEGE[base] || name}${oct}`, isBlack });
    }
  }
  return result;
});

function formatNote(note: string): string {
  if (note === 'rest') return '0';
  const m = note.match(/^([A-G]#?)(\d)$/);
  if (!m) return note;
  const base = m[1].replace('#', '');
  const s = SOLFEGE[base] || m[1];
  return m[1].includes('#') ? `${s}#${m[2]}` : `${s}${m[2]}`;
}

function tokenClass(token: JianpuToken) {
  if (token.melodyIndex === undefined) return {};
  return {
    current: currentNoteIndex.value === token.melodyIndex,
    played: token.melodyIndex < currentNoteIndex.value,
  };
}

function octaveClass(token: JianpuToken) {
  if (!token.octave) return '';
  if (token.octave >= 5) return 'high';
  if (token.octave <= 3) return 'low';
  return '';
}

function playNote(note: string, duration: number) {
  if (note === 'rest') return;
  const ctx = getAudioContext();
  const freq = NOTE_FREQS[note];
  if (!freq) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);

  activeNotes.value = new Set([...activeNotes.value, note]);
  setTimeout(() => {
    const next = new Set(activeNotes.value);
    next.delete(note);
    activeNotes.value = next;
  }, duration * 1000);
}

async function play() {
  if (isPlaying.value || props.melody.length === 0) return;
  isPlaying.value = true;
  aborted = false;
  currentNoteIndex.value = -1;

  const startTime = Date.now();
  try {
    for (let i = 0; i < props.melody.length; i++) {
      if (aborted) break;
      const note = props.melody[i];
      const elapsed = (Date.now() - startTime) / 1000;
      const wait = note.time - elapsed;
      if (wait > 0) await new Promise(r => setTimeout(r, wait * 1000));
      if (aborted) break;

      currentNoteIndex.value = i;
      nextTick(() => {
        const el = pianoScoreRef.value?.children[i] as HTMLElement | undefined;
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      });
      playNote(note.note, note.duration);
    }
    if (!aborted && props.melody.length > 0) {
      const last = props.melody[props.melody.length - 1];
      await new Promise(r => setTimeout(r, last.duration * 1000));
    }
  } finally {
    isPlaying.value = false;
    currentNoteIndex.value = -1;
  }
}

function stop() { aborted = true; }

function handleClose() {
  aborted = true;
  emit('close');
}

onUnmounted(() => {
  aborted = true;
  if (audioCtx) { audioCtx.close(); audioCtx = null; }
});
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
}

.modal {
  width: 90vw;
  max-width: 860px;
  max-height: 90vh;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md, 8px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Header */
.modalHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 28px 16px;
  border-bottom: 1px solid var(--color-border);
}

.songMeta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.songName {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0;
  letter-spacing: 0.5px;
}

.songArtist {
  font-size: 13px;
  color: var(--color-text-secondary);
  letter-spacing: 0.3px;
}

.closeBtn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.closeBtn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

/* Score sections */
.scoreSection {
  padding: 16px 28px;
  border-bottom: 1px solid var(--color-border);
}

.scoreLabel {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--color-text-disabled);
  margin-bottom: 10px;
}

/* Sheet music display (jianpu) */
.sheetDisplay {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
  font-family: 'Georgia', 'Times New Roman', serif;
  font-size: 20px;
  line-height: 2.4;
  color: var(--color-text-primary);
  user-select: text;
  padding: 4px 0;
}

.tok {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  min-width: 24px;
  text-align: center;
  transition: all 0.15s;
}

.tok.bar {
  color: var(--color-text-disabled);
  margin: 0 6px;
  min-width: auto;
}

.tok.extend {
  color: var(--color-text-secondary);
}

.tok.dot {
  color: var(--color-text-secondary);
  min-width: 12px;
}

.tok.rest {
  color: var(--color-text-disabled);
}

.tok.note {
  font-weight: 500;
}

.tok.note.high {
  color: var(--color-text-primary);
}

.tok.note.low {
  color: var(--color-text-secondary);
}

.tok.current {
  color: var(--color-accent-inverse);
  background: var(--color-accent);
  border-radius: var(--radius-sm);
  font-weight: 700;
  transform: scale(1.15);
  z-index: 1;
}

.tok.played {
  opacity: 0.35;
}

/* Octave dots */
.octaveDot {
  position: absolute;
  font-size: 14px;
  line-height: 1;
  font-weight: 700;
}

.octaveDot.top {
  top: 2px;
  left: 50%;
  transform: translateX(-50%);
}

.octaveDot.top.second {
  top: -6px;
}

.octaveDot.bottom {
  bottom: 4px;
  left: 50%;
  transform: translateX(-50%);
}

.octaveDot.bottom.second {
  bottom: -4px;
}

/* Piano score */
.pianoScore {
  display: flex;
  gap: 3px;
  overflow-x: auto;
  padding: 4px 0;
}

.pianoNote {
  flex-shrink: 0;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-bg-primary);
  font-size: 11px;
  font-family: monospace;
  color: var(--color-text-secondary);
  transition: all 0.15s;
}

.pianoNote.played {
  opacity: 0.3;
  border-color: transparent;
}

.pianoNote.current {
  background: var(--color-accent);
  color: var(--color-accent-inverse);
  border-color: var(--color-accent);
  font-weight: 600;
  transform: scale(1.1);
}

/* Keyboard */
.keyboardSection {
  padding: 16px 28px;
  border-bottom: 1px solid var(--color-border);
  overflow-x: auto;
}

.keyboard {
  display: flex;
  position: relative;
  height: 100px;
  user-select: none;
  min-width: max-content;
}

.key {
  position: relative;
  border: 1px solid var(--color-border);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 4px;
  transition: background-color 0.08s;
  cursor: pointer;
  user-select: none;
}

.key.white {
  min-width: 24px;
  flex: 1 0 24px;
  height: 100%;
  background: var(--color-bg-primary);
  z-index: 1;
  border-radius: 0 0 3px 3px;
}

.key.white.active {
  background: var(--color-accent);
}

.key.black {
  width: 18px;
  height: 62%;
  background: var(--color-text-primary);
  margin-left: -9px;
  margin-right: -9px;
  z-index: 2;
  border-radius: 0 0 3px 3px;
  border-color: var(--color-text-primary);
  flex-shrink: 0;
}

.key.black.active {
  background: var(--color-text-secondary);
}

.keyLabel {
  font-size: 7px;
  color: var(--color-text-disabled);
  pointer-events: none;
  white-space: nowrap;
}

.key.active .keyLabel {
  color: var(--color-accent-inverse);
}

/* Controls */
.controls {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 16px 28px;
}

.controlBtn {
  padding: 8px 24px;
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  border: 1px solid var(--color-border);
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
}

.controlBtn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.controlBtn.primary {
  border-color: var(--color-accent);
  background: var(--color-accent);
  color: var(--color-accent-inverse);
}

.controlBtn.primary:hover:not(:disabled) {
  opacity: 0.85;
}

.controlBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .modal {
    width: 100vw;
    max-width: none;
    height: 100vh;
    max-height: none;
    border-radius: 0;
  }

  .modalHeader, .scoreSection, .keyboardSection, .controls {
    padding-left: 16px;
    padding-right: 16px;
  }

  .sheetDisplay {
    font-size: 18px;
  }

  .keyboard {
    height: 80px;
  }

  .key.white {
    min-width: 18px;
    flex: 1 0 18px;
  }

  .key.black {
    width: 14px;
    margin-left: -7px;
    margin-right: -7px;
  }
}
</style>
