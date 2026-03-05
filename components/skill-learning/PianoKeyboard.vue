<template>
  <div class="pianoKeyboard">
    <!-- Play button for audioSpec mode -->
    <div v-if="audioSpec" class="audioControls">
      <button class="playBtn" :disabled="isPlaying" @click="playAudioSpec">
        {{ isPlaying ? '播放中...' : '播放音频' }}
      </button>
      <span class="audioHint">
        {{ audioSpec.simultaneous ? '(同时播放)' : '(依次播放)' }}
      </span>
    </div>

    <!-- Melody playback controls -->
    <div v-if="melody && melody.length > 0 && !audioSpec" class="audioControls">
      <button class="playBtn" :disabled="isPlayingMelody" @click="playMelody">
        {{ isPlayingMelody ? '演奏中...' : '演奏旋律' }}
      </button>
      <button v-if="isPlayingMelody" class="stopBtn" @click="stopMelody">停止</button>
    </div>

    <!-- Melody score display -->
    <div v-if="melody && melody.length > 0 && showKeyboard" ref="scoreRef" class="melodyScore">
      <div
        v-for="(n, i) in melody"
        :key="i"
        class="scoreNote"
        :class="{ current: currentNoteIndex === i, played: i < currentNoteIndex }"
      >
        <span class="scoreNoteName">{{ formatNoteName(n.note) }}</span>
      </div>
    </div>

    <!-- Keyboard -->
    <div v-if="showKeyboard" class="keyboard">
      <div
        v-for="key in keys"
        :key="key.note"
        class="key"
        :class="{
          black: key.isBlack,
          white: !key.isBlack,
          active: activeNotes.has(key.note),
          highlighted: highlightedNotes.has(key.note),
        }"
        @mousedown="playNote(key.note)"
        @touchstart.prevent="playNote(key.note)"
      >
        <span v-if="showLabels && !key.isBlack" class="keyLabel">{{ key.label }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AudioSpec, MelodyNote } from '~/composables/skill-learning/types';

const props = withDefaults(defineProps<{
  audioSpec?: AudioSpec | null;
  melody?: MelodyNote[] | null;
  showLabels?: boolean;
  showKeyboard?: boolean;
  startOctave?: number;
  endOctave?: number;
}>(), {
  audioSpec: null,
  melody: null,
  showLabels: true,
  showKeyboard: true,
  startOctave: 4,
  endOctave: 5,
});

const activeNotes = ref<Set<string>>(new Set());
const highlightedNotes = ref<Set<string>>(new Set());
const isPlaying = ref(false);
const isPlayingMelody = ref(false);
const currentNoteIndex = ref(-1);
const scoreRef = ref<HTMLElement | null>(null);
let melodyAbort = false;

function formatNoteName(note: string): string {
  const match = note.match(/^([A-G]#?)(\d)$/);
  if (!match) return note;
  const [, name, octave] = match;
  const baseName = name.replace('#', '');
  const solfege = SOLFEGE[baseName] || name;
  return name.includes('#') ? `${solfege}#${octave}` : `${solfege}${octave}`;
}

// AudioContext singleton
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// Note frequencies mapping
const NOTE_FREQS: Record<string, number> = {};
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SOLFEGE: Record<string, string> = {
  C: 'do', D: 're', E: 'mi', F: 'fa', G: 'sol', A: 'la', B: 'si',
};

// Generate frequencies for octaves 1-7 (covers any possible range)
for (let octave = 1; octave <= 7; octave++) {
  for (let i = 0; i < 12; i++) {
    const noteName = NOTE_NAMES[i];
    const key = `${noteName}${octave}`;
    const semitonesFromA4 = (octave - 4) * 12 + (i - 9);
    NOTE_FREQS[key] = 440 * Math.pow(2, semitonesFromA4 / 12);
  }
}

interface KeyDef {
  note: string;
  label: string;
  isBlack: boolean;
}

// Generate keyboard based on octave range
const keys = computed<KeyDef[]>(() => {
  const result: KeyDef[] = [];
  for (let octave = props.startOctave; octave <= props.endOctave; octave++) {
    for (const name of NOTE_NAMES) {
      const note = `${name}${octave}`;
      const isBlack = name.includes('#');
      const baseName = name.replace('#', '');
      const label = SOLFEGE[baseName] || name;
      result.push({ note, label: isBlack ? '' : `${label}${octave}`, isBlack });
    }
  }
  return result;
});

// Highlight audioSpec notes
watch(() => props.audioSpec, (spec) => {
  if (spec?.notes) {
    highlightedNotes.value = new Set(spec.notes);
  } else {
    highlightedNotes.value = new Set();
  }
}, { immediate: true });

function playNote(note: string, duration = 0.5) {
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

  // Visual feedback
  activeNotes.value = new Set([...activeNotes.value, note]);
  setTimeout(() => {
    const next = new Set(activeNotes.value);
    next.delete(note);
    activeNotes.value = next;
  }, duration * 1000);
}

async function playAudioSpec() {
  if (!props.audioSpec || isPlaying.value) return;

  isPlaying.value = true;
  const { notes, simultaneous } = props.audioSpec;

  try {
    if (simultaneous) {
      for (const note of notes) {
        playNote(note, 1.0);
      }
      await new Promise(r => setTimeout(r, 1200));
    } else {
      for (const note of notes) {
        playNote(note, 0.6);
        await new Promise(r => setTimeout(r, 700));
      }
    }
  } finally {
    isPlaying.value = false;
  }
}

async function playMelody() {
  if (!props.melody || props.melody.length === 0 || isPlayingMelody.value) return;

  isPlayingMelody.value = true;
  melodyAbort = false;
  currentNoteIndex.value = -1;

  const melody = props.melody;
  const startTime = Date.now();

  try {
    for (let i = 0; i < melody.length; i++) {
      if (melodyAbort) break;

      const note = melody[i];
      // Wait until the note's scheduled time
      const elapsed = (Date.now() - startTime) / 1000;
      const waitTime = note.time - elapsed;
      if (waitTime > 0) {
        await new Promise(r => setTimeout(r, waitTime * 1000));
      }

      if (melodyAbort) break;
      currentNoteIndex.value = i;

      // Auto-scroll the score to keep current note visible
      nextTick(() => {
        const el = scoreRef.value?.children[i] as HTMLElement | undefined;
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      });

      playNote(note.note, note.duration);
    }

    // Wait for last note to finish
    if (!melodyAbort && melody.length > 0) {
      const lastNote = melody[melody.length - 1];
      await new Promise(r => setTimeout(r, lastNote.duration * 1000));
    }
  } finally {
    isPlayingMelody.value = false;
    currentNoteIndex.value = -1;
  }
}

function stopMelody() {
  melodyAbort = true;
}

defineExpose({ playMelody, isPlayingMelody });

onUnmounted(() => {
  melodyAbort = true;
  if (audioCtx) {
    audioCtx.close();
    audioCtx = null;
  }
});
</script>

<style scoped>
.pianoKeyboard {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.audioControls {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-xs);
}

.playBtn {
  padding: var(--spacing-xs) var(--spacing-md);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: var(--color-accent-inverse);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}

.playBtn:hover:not(:disabled) {
  opacity: 0.85;
}

.playBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.stopBtn {
  padding: var(--spacing-xs) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.stopBtn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.audioHint {
  font-size: 12px;
  color: var(--color-text-secondary);
}

/* Melody score */
.melodyScore {
  display: flex;
  gap: 4px;
  padding: var(--spacing-xs) var(--spacing-sm);
  overflow-x: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-secondary, var(--color-bg-primary));
}

.scoreNote {
  flex-shrink: 0;
  padding: 3px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-bg-primary);
  font-size: 12px;
  font-family: monospace;
  color: var(--color-text-secondary);
  transition: all 0.15s;
}

.scoreNote.played {
  color: var(--color-text-disabled);
  border-color: transparent;
}

.scoreNote.current {
  background: var(--color-accent);
  color: var(--color-accent-inverse);
  border-color: var(--color-accent);
  font-weight: 600;
  transform: scale(1.1);
}

/* Keyboard layout */
.keyboard {
  display: flex;
  position: relative;
  height: 120px;
  user-select: none;
  overflow-x: auto;
}

.key {
  position: relative;
  cursor: pointer;
  transition: background-color 0.1s;
  border: 1px solid var(--color-border);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 6px;
}

.key.white {
  min-width: 36px;
  flex: 1 0 36px;
  height: 100%;
  background: var(--color-bg-primary);
  z-index: 1;
  border-radius: 0 0 var(--radius-sm) var(--radius-sm);
}

.key.white:hover {
  background: var(--color-bg-hover);
}

.key.white.active {
  background: var(--color-accent);
}

.key.white.highlighted:not(.active) {
  background: var(--color-bg-hover);
  border-color: var(--color-accent);
}

.key.black {
  width: 28px;
  height: 65%;
  background: var(--color-text-primary);
  margin-left: -14px;
  margin-right: -14px;
  z-index: 2;
  border-radius: 0 0 var(--radius-sm) var(--radius-sm);
  border-color: var(--color-text-primary);
  flex-shrink: 0;
}

.key.black:hover {
  background: var(--color-text-secondary);
}

.key.black.active {
  background: var(--color-text-secondary);
}

.key.black.highlighted:not(.active) {
  background: var(--color-text-secondary);
}

.keyLabel {
  font-size: 9px;
  color: var(--color-text-secondary);
  pointer-events: none;
  white-space: nowrap;
}

.key.active .keyLabel {
  color: var(--color-accent-inverse);
}

@media (max-width: 768px) {
  .keyboard {
    height: 100px;
  }

  .key.white {
    min-width: 28px;
    flex: 1 0 28px;
  }

  .key.black {
    width: 22px;
    margin-left: -11px;
    margin-right: -11px;
  }

  .keyLabel {
    font-size: 8px;
  }
}
</style>
