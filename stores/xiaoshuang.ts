export const useXiaoshuangStore = defineStore('xiaoshuang', () => {
  const isOpen = ref(false);
  const messages = ref<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const isLoading = ref(false);
  const unreadCount = ref(0);

  function toggle() { isOpen.value = !isOpen.value; }
  function open() { isOpen.value = true; }
  function close() { isOpen.value = false; }

  async function send(text: string) {
    if (!text.trim() || isLoading.value) return;

    messages.value.push({ role: 'user', content: text });
    isLoading.value = true;

    try {
      const result = await $fetch<{ reply: string }>('/api/coach/chat', {
        method: 'POST',
        body: {
          message: text,
          context: 'chat',
          history: messages.value.slice(0, -1),
        },
      });
      messages.value.push({ role: 'assistant', content: result.reply });
    } catch {
      messages.value.push({ role: 'assistant', content: '抱歉，小爽暂时无法回复。请检查 LLM 配置。' });
    } finally {
      isLoading.value = false;
    }
  }

  async function loadPendingCount() {
    try {
      const data = await $fetch<Array<any>>('/api/coach/pending');
      unreadCount.value = data.length;
    } catch {
      unreadCount.value = 0;
    }
  }

  function clearMessages() {
    messages.value = [];
  }

  return { isOpen, messages, isLoading, unreadCount, toggle, open, close, send, loadPendingCount, clearMessages };
});
