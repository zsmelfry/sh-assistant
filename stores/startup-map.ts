import { defineStore } from 'pinia';
import type {
  StartupMapView,
  DomainWithStats,
  DomainDetail,
  PointDetail,
  SmTeaching,
  SmChat,
  SmProduct,
  GlobalStats,
  PointStatus,
  ProductFormData,
  TeachingSection,
  ChatResponse,
} from '~/tools/startup-map/types';

export const useStartupMapStore = defineStore('startup-map', () => {
  // ===== 视图状态 =====
  const currentView = ref<StartupMapView>('global');
  const currentDomainId = ref<number | null>(null);
  const currentPointId = ref<number | null>(null);

  // ===== 领域数据 =====
  const domains = ref<DomainWithStats[]>([]);
  const domainsLoading = ref(false);

  // ===== 当前领域详情 =====
  const currentDomain = ref<DomainDetail | null>(null);
  const domainLoading = ref(false);

  // ===== 当前知识点详情 =====
  const currentPoint = ref<PointDetail | null>(null);
  const pointLoading = ref(false);

  // ===== 教学内容 =====
  const teaching = ref<SmTeaching | null>(null);
  const generating = ref(false);
  const streamingSections = ref<Record<TeachingSection, string>>({
    what: '', how: '', example: '', apply: '', resources: '',
  });

  // ===== 聊天 =====
  const chats = ref<SmChat[]>([]);
  const chatLoading = ref(false);
  const chatSending = ref(false);
  const chatError = ref<string | null>(null);

  // ===== 产品 =====
  const activeProduct = ref<SmProduct | null>(null);
  const productLoading = ref(false);
  const productSaving = ref(false);

  // ===== 全局统计（computed from domains） =====
  const globalStats = computed<GlobalStats>(() => {
    const total = domains.value.reduce((sum, d) => sum + d.pointCount, 0);
    const completed = domains.value.reduce((sum, d) => sum + d.completedCount, 0);
    return {
      totalPoints: total,
      completedCount: completed,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  });

  // ===== 面包屑辅助 =====
  const breadcrumbDomainName = computed(() =>
    currentPoint.value?.domain.name ?? currentDomain.value?.name ?? '',
  );
  const breadcrumbPointName = computed(() => currentPoint.value?.name ?? '');

  // ===== 导航 =====
  function navigateToGlobal() {
    currentView.value = 'global';
    currentDomainId.value = null;
    currentPointId.value = null;
    loadDomains();
  }

  function navigateToDomain(domainId: number) {
    currentView.value = 'domain';
    currentDomainId.value = domainId;
    currentPointId.value = null;
    loadDomain(domainId);
  }

  function navigateToPoint(pointId: number) {
    currentView.value = 'point';
    currentPointId.value = pointId;
    loadPoint(pointId);
  }

  function navigateToProduct() {
    currentView.value = 'product';
  }

  // ===== 领域操作 =====
  async function loadDomains() {
    domainsLoading.value = true;
    try {
      domains.value = await $fetch<DomainWithStats[]>('/api/startup-map/domains');
    } catch {
      // API not ready yet — fail silently
    } finally {
      domainsLoading.value = false;
    }
  }

  async function loadDomain(id: number) {
    domainLoading.value = true;
    try {
      currentDomain.value = await $fetch<DomainDetail>(`/api/startup-map/domains/${id}`);
    } catch {
      currentDomain.value = null;
    } finally {
      domainLoading.value = false;
    }
  }

  // ===== 知识点操作 =====
  async function loadPoint(id: number) {
    pointLoading.value = true;
    teaching.value = null;
    chats.value = [];
    chatError.value = null;
    try {
      const point = await $fetch<PointDetail>(`/api/startup-map/points/${id}`);
      currentPoint.value = point;
      currentDomainId.value = point.domain.id;
      teaching.value = point.teaching;
    } catch {
      currentPoint.value = null;
    } finally {
      pointLoading.value = false;
    }
  }

  async function updatePointStatus(pointId: number, status: PointStatus) {
    if (!currentPoint.value || currentPoint.value.id !== pointId) return;

    const oldStatus = currentPoint.value.status;
    currentPoint.value = { ...currentPoint.value, status, statusUpdatedAt: Date.now() };

    try {
      await $fetch(`/api/startup-map/points/${pointId}/status`, {
        method: 'PATCH',
        body: { status },
      });
    } catch {
      if (currentPoint.value?.id === pointId) {
        currentPoint.value = { ...currentPoint.value, status: oldStatus };
      }
    }
  }

  // ===== 教学内容 =====
  async function generateTeaching(pointId: number, regenerate = false) {
    generating.value = true;
    streamingSections.value = { what: '', how: '', example: '', apply: '', resources: '' };

    try {
      // Auto-set status to 'learning' if currently 'not_started'
      if (currentPoint.value?.status === 'not_started') {
        await updatePointStatus(pointId, 'learning');
      }

      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/startup-map/points/${pointId}/teaching`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ regenerate }),
      });

      if (!response.ok) throw new Error('生成失败');
      if (!response.body) throw new Error('无响应流');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // Fallback: raw buffer for chunks without section field
      let rawStreamBuffer = '';
      const sectionOrder: TeachingSection[] = ['what', 'how', 'example', 'apply', 'resources'];
      let currentSectionIdx = 0;
      const BREAK = '---SECTION_BREAK---';

      function parseSectionBreaks() {
        while (rawStreamBuffer.includes(BREAK)) {
          const idx = rawStreamBuffer.indexOf(BREAK);
          const chunk = rawStreamBuffer.slice(0, idx);
          rawStreamBuffer = rawStreamBuffer.slice(idx + BREAK.length);
          if (currentSectionIdx < sectionOrder.length) {
            const section = sectionOrder[currentSectionIdx];
            streamingSections.value = { ...streamingSections.value, [section]: chunk.trim() };
            currentSectionIdx++;
          }
        }
        // Remaining text belongs to the current section (still streaming)
        if (currentSectionIdx < sectionOrder.length) {
          const section = sectionOrder[currentSectionIdx];
          streamingSections.value = { ...streamingSections.value, [section]: rawStreamBuffer };
        }
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'cached') {
              // Server returned cached content — skip streaming
              teaching.value = data.teaching;
            } else if (data.type === 'chunk') {
              if (data.section) {
                const section = data.section as TeachingSection;
                streamingSections.value = {
                  ...streamingSections.value,
                  [section]: streamingSections.value[section] + data.content,
                };
              } else {
                // Fallback: no section field, append to raw buffer and parse SECTION_BREAK
                rawStreamBuffer += data.content;
                parseSectionBreaks();
              }
            } else if (data.type === 'done') {
              teaching.value = data.teaching;
            } else if (data.type === 'error') {
              throw new Error(data.message);
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
    } finally {
      generating.value = false;
    }
  }

  // ===== 聊天 =====
  async function loadChats(pointId: number) {
    chatLoading.value = true;
    try {
      chats.value = await $fetch<SmChat[]>(`/api/startup-map/points/${pointId}/chats`);
    } catch {
      chats.value = [];
    } finally {
      chatLoading.value = false;
    }
  }

  async function sendChat(pointId: number, message: string) {
    if (!message.trim()) return;
    chatSending.value = true;
    chatError.value = null;

    const tempMsg: SmChat = {
      id: -Date.now(),
      pointId,
      role: 'user',
      content: message.trim(),
      createdAt: Date.now(),
    };
    chats.value = [...chats.value, tempMsg];

    try {
      const res = await $fetch<ChatResponse>(`/api/startup-map/points/${pointId}/chat`, {
        method: 'POST',
        body: { message: message.trim() },
      });
      chats.value = [
        ...chats.value.filter(m => m.id !== tempMsg.id),
        res.userMessage,
        res.assistantMessage,
      ];
    } catch (e: any) {
      chats.value = chats.value.filter(m => m.id !== tempMsg.id);
      chatError.value = e?.data?.message || e?.message || 'AI 回复失败';
    } finally {
      chatSending.value = false;
    }
  }

  async function clearChats(pointId: number) {
    try {
      await $fetch(`/api/startup-map/points/${pointId}/chats`, { method: 'DELETE' });
      chats.value = [];
    } catch {
      // Silently fail
    }
  }

  // ===== 产品 =====
  async function loadActiveProduct() {
    productLoading.value = true;
    try {
      activeProduct.value = await $fetch<SmProduct>('/api/startup-map/products/active');
    } catch {
      activeProduct.value = null;
    } finally {
      productLoading.value = false;
    }
  }

  async function createProduct(data: ProductFormData) {
    productSaving.value = true;
    try {
      const product = await $fetch<SmProduct>('/api/startup-map/products', {
        method: 'POST',
        body: data,
      });
      activeProduct.value = product;
    } finally {
      productSaving.value = false;
    }
  }

  async function updateProduct(id: number, data: ProductFormData) {
    productSaving.value = true;
    try {
      const product = await $fetch<SmProduct>(`/api/startup-map/products/${id}`, {
        method: 'PUT',
        body: data,
      });
      activeProduct.value = product;
    } finally {
      productSaving.value = false;
    }
  }

  return {
    // 视图状态
    currentView, currentDomainId, currentPointId,
    // 领域数据
    domains, domainsLoading,
    // 当前领域
    currentDomain, domainLoading,
    // 当前知识点
    currentPoint, pointLoading,
    // 教学内容
    teaching, generating, streamingSections,
    // 聊天
    chats, chatLoading, chatSending, chatError,
    // 产品
    activeProduct, productLoading, productSaving,
    // 统计
    globalStats,
    // 面包屑
    breadcrumbDomainName, breadcrumbPointName,
    // 导航
    navigateToGlobal, navigateToDomain, navigateToPoint, navigateToProduct,
    // 领域操作
    loadDomains, loadDomain,
    // 知识点操作
    loadPoint, updatePointStatus,
    // 教学内容
    generateTeaching,
    // 聊天操作
    loadChats, sendChat, clearChats,
    // 产品操作
    loadActiveProduct, createProduct, updateProduct,
  };
});
