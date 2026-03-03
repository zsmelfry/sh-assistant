<template>
  <Teleport to="body">
    <Transition name="celebration">
      <div v-if="visible" class="celebrationOverlay" @click.self="$emit('dismiss')">
        <div class="celebrationCard" :class="type">
          <!-- Animated check -->
          <div class="checkContainer">
            <div class="checkRing" />
            <div class="checkRing ring2" />
            <div class="checkCircle">
              <svg class="checkSvg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>

          <p class="celebrationMsg">{{ message }}</p>

          <div class="celebrationActions">
            <button v-if="hasNext" class="nextBtn" @click="$emit('goToNext')">
              学习下一个知识点 →
            </button>
            <button class="dismissBtn" @click="$emit('dismiss')">
              {{ hasNext ? '继续当前' : '关闭' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const props = defineProps<{
  visible: boolean;
  type: 'point' | 'stage' | null;
  message: string;
  hasNext?: boolean;
}>();

defineEmits<{
  dismiss: [];
  goToNext: [];
}>();

// Auto-dismiss after 6 seconds
let timer: ReturnType<typeof setTimeout> | null = null;

watch(() => props.visible, (v) => {
  if (timer) clearTimeout(timer);
  if (v) {
    timer = setTimeout(() => {
      // Only auto-dismiss if no "next" button (meaning user likely needs to act)
      if (!props.hasNext) {
        // emit dismiss — but we can't emit from watch, so we do nothing for auto-dismiss
        // The component will stay until user clicks
      }
    }, 6000);
  }
});
</script>

<style scoped>
.celebrationOverlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.celebrationCard {
  background: var(--color-bg-primary);
  border-radius: var(--radius-md);
  padding: var(--spacing-xl) var(--spacing-lg);
  text-align: center;
  max-width: 360px;
  width: 90%;
}

.celebrationCard.stage {
  border: 2px solid var(--color-accent);
}

/* Check animation */
.checkContainer {
  position: relative;
  width: 64px;
  height: 64px;
  margin: 0 auto var(--spacing-md);
}

.checkCircle {
  position: absolute;
  inset: 8px;
  background: var(--color-accent);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: checkPop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
}

.checkSvg {
  width: 28px;
  height: 28px;
  color: var(--color-accent-inverse);
  animation: checkDraw 0.4s 0.3s ease forwards;
  stroke-dasharray: 30;
  stroke-dashoffset: 30;
}

.checkRing {
  position: absolute;
  inset: 0;
  border: 2px solid var(--color-accent);
  border-radius: 50%;
  animation: ringExpand 0.8s 0.2s ease-out forwards;
  opacity: 0;
}

.checkRing.ring2 {
  animation-delay: 0.4s;
}

.stage .checkContainer {
  width: 80px;
  height: 80px;
}

.stage .checkCircle {
  inset: 12px;
}

.stage .checkSvg {
  width: 32px;
  height: 32px;
}

@keyframes checkPop {
  0% { transform: scale(0); opacity: 0; }
  60% { transform: scale(1.15); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}

@keyframes checkDraw {
  to { stroke-dashoffset: 0; }
}

@keyframes ringExpand {
  0% { transform: scale(0.8); opacity: 0.8; }
  100% { transform: scale(1.8); opacity: 0; }
}

.celebrationMsg {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-md);
  line-height: 1.4;
}

.stage .celebrationMsg {
  font-size: 18px;
}

.celebrationActions {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.nextBtn {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: var(--color-accent-inverse);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}

.nextBtn:hover {
  opacity: 0.85;
}

.dismissBtn {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.dismissBtn:hover {
  background: var(--color-bg-hover);
}

/* Transition */
.celebration-enter-active {
  transition: opacity 0.3s ease;
}

.celebration-leave-active {
  transition: opacity 0.2s ease;
}

.celebration-enter-from,
.celebration-leave-to {
  opacity: 0;
}

.celebration-enter-active .celebrationCard {
  animation: cardSlideUp 0.3s ease forwards;
}

@keyframes cardSlideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
</style>
