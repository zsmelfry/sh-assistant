const MAX_HEIGHT = 150;

/**
 * Auto-resize a textarea to fit its content, up to a maximum height.
 * Returns a ref for the element and an `autoResize` function to bind on @input.
 * Call `resetHeight` after clearing the input (e.g. on send).
 */
export function useAutoResize() {
  const textareaRef = ref<HTMLTextAreaElement | null>(null);

  function autoResize() {
    const el = textareaRef.value;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, MAX_HEIGHT) + 'px';
  }

  function resetHeight() {
    const el = textareaRef.value;
    if (!el) return;
    el.style.height = 'auto';
  }

  return { textareaRef, autoResize, resetHeight };
}
