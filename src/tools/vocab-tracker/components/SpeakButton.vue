<template>
  <button
    type="button"
    class="speakBtn"
    :class="[sizeClass, { speaking: tts.speaking.value }]"
    :title="tts.speaking.value ? '停止朗读' : '朗读发音'"
    @click.stop="handleClick"
  >
    <Volume2 :size="iconSize" :stroke-width="1.5" />
  </button>
</template>

<script setup lang="ts">
import { Volume2 } from 'lucide-vue-next';

const props = withDefaults(defineProps<{
  text: string;
  size?: 'sm' | 'md';
  lang?: string;
}>(), {
  size: 'md',
  lang: 'fr-FR',
});

const tts = useTts();

const sizeClass = computed(() => `size-${props.size}`);
const iconSize = computed(() => props.size === 'sm' ? 14 : 16);

async function handleClick() {
  if (tts.speaking.value) {
    tts.stop();
    return;
  }
  await tts.speak(props.text, props.lang);
}
</script>

<style scoped>
.speakBtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
}

.speakBtn:hover {
  background-color: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.speakBtn.speaking {
  color: var(--color-accent);
  background-color: var(--color-bg-hover);
}

.size-sm {
  width: 24px;
  height: 24px;
}

.size-md {
  width: 32px;
  height: 32px;
}
</style>
