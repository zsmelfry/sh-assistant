import { defineStore } from 'pinia';
import type { InjectionKey } from 'vue';
import type {
  SkillLearningView,
  GlobalTab,
  DomainWithStats,
  DomainDetail,
  PointDetail,
  SmTeaching,
  SmChat,
  SmTask,
  SmNote,
  GlobalStats,
  EnhancedGlobalStats,
  DomainStatItem,
  StageWithStats,
  StageDetail,
  RecommendedPoint,
  PointStatus,
  TeachingSection,
  ChatResponse,
  ActivityType,
  ActivityWithPointName,
  ActivitiesPage,
  LinkedArticle,
  SmQuizWithAttempt,
  GuidanceResponse,
} from './types';

/**
 * Factory function that creates a Pinia store for skill learning.
 * Each skill tool calls this with its own skillId to get an isolated store.
 *
 * API paths use `/api/skills/${skillId}/...` pattern.
 */
export function createSkillLearningStore(skillId: string) {
  return defineStore(`skill-${skillId}`, () => {
    const baseUrl = `/api/skills/${skillId}`;

    // Helper: fetch data into a ref with loading state and fallback on error
    async function fetchTo<T>(
      loading: Ref<boolean>,
      target: Ref<T>,
      fetcher: () => Promise<T>,
      fallback: T,
    ) {
      loading.value = true;
      try {
        target.value = await fetcher();
      } catch {
        target.value = fallback;
      } finally {
        loading.value = false;
      }
    }

    // ===== 视图状态 =====
    const currentView = ref<SkillLearningView>('global');
    const globalTab = ref<GlobalTab>('overview');
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

    // ===== 学习阶段 =====
    const stages = ref<StageWithStats[]>([]);
    const stagesLoading = ref(false);
    const currentStage = ref<StageDetail | null>(null);
    const stageLoading = ref(false);

    // ===== 实践任务 =====
    const tasks = ref<SmTask[]>([]);
    const tasksLoading = ref(false);
    const tasksGenerating = ref(false);

    // ===== 笔记 =====
    const note = ref<SmNote | null>(null);
    const noteSaving = ref(false);
    const noteLastSaved = ref<number | null>(null);

    // ===== 学习建议 =====
    const recommendations = ref<RecommendedPoint[]>([]);
    const recommendationsLoading = ref(false);

    // ===== 增强统计 =====
    const enhancedStats = ref<EnhancedGlobalStats | null>(null);
    const domainStats = ref<DomainStatItem[]>([]);

    // ===== 文章关联 =====
    const linkedArticles = ref<LinkedArticle[]>([]);
    const linkedArticlesLoading = ref(false);

    // ===== 热力图 + 连续天数 =====
    const heatmapData = ref<Record<string, number>>({});
    const heatmapYear = ref(new Date().getFullYear());
    const currentStreak = ref(0);

    // ===== 学习记录 =====
    const activities = ref<ActivityWithPointName[]>([]);
    const activitiesLoading = ref(false);
    const activitiesPage = ref(1);
    const activitiesTotalPages = ref(0);

    // ===== 理解测验 =====
    const quizzes = ref<SmQuizWithAttempt[]>([]);
    const quizzesLoading = ref(false);
    const quizzesGenerating = ref(false);

    // ===== AI 引导 =====
    const guidance = ref<GuidanceResponse | null>(null);
    const guidanceLoading = ref(false);

    // ===== 完成庆祝 =====
    const showCelebration = ref(false);
    const celebrationType = ref<'point' | 'stage' | null>(null);
    const celebrationMessage = ref('');

    // ===== 种子数据 =====
    const seeding = ref(false);

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

    function switchGlobalTab(tab: GlobalTab) {
      globalTab.value = tab;
      if (tab === 'overview') {
        loadStages();
      } else if (tab === 'heatmap') {
        loadHeatmap();
        loadStreak();
      }
    }

    // ===== 种子数据操作 =====
    async function seedData() {
      seeding.value = true;
      try {
        await $fetch(`${baseUrl}/seed`, { method: 'POST' });
        await loadDomains();
        loadStages();
        loadEnhancedStats();
      } finally {
        seeding.value = false;
      }
    }

    // ===== 领域操作 =====
    async function loadDomains() {
      await fetchTo(domainsLoading, domains,
        () => $fetch<DomainWithStats[]>(`${baseUrl}/domains`), []);
    }

    async function loadDomain(id: number) {
      await fetchTo(domainLoading, currentDomain,
        () => $fetch<DomainDetail>(`${baseUrl}/domains/${id}`), null);
    }

    // ===== 知识点操作 =====
    async function loadPoint(id: number) {
      pointLoading.value = true;
      teaching.value = null;
      chats.value = [];
      chatError.value = null;
      tasks.value = [];
      note.value = null;
      noteLastSaved.value = null;
      linkedArticles.value = [];
      quizzes.value = [];
      guidance.value = null;
      showCelebration.value = false;
      try {
        const point = await $fetch<PointDetail>(`${baseUrl}/points/${id}`);
        currentPoint.value = point;
        currentDomainId.value = point.domain.id;
        teaching.value = point.teaching;
        // Auto-load quizzes and guidance when teaching exists
        if (point.teaching) {
          loadQuizzes(id);
          loadGuidance(id);
        }
      } catch {
        currentPoint.value = null;
      } finally {
        pointLoading.value = false;
      }
    }

    async function updatePointStatus(pointId: number, status: PointStatus) {
      if (!currentPoint.value || currentPoint.value.id !== pointId) return;

      const oldStatus = currentPoint.value.status;
      const wasCompleted = oldStatus === 'understood' || oldStatus === 'practiced';
      const isNowCompleted = status === 'understood' || status === 'practiced';

      currentPoint.value = { ...currentPoint.value, status, statusUpdatedAt: Date.now() };

      try {
        await $fetch(`${baseUrl}/points/${pointId}/status`, {
          method: 'PATCH',
          body: { status },
        });

        // Trigger celebration on transition to completed
        if (!wasCompleted && isNowCompleted) {
          triggerCelebration('point', '知识点学习完成！');
          // Refresh recommendations for next point card
          loadRecommendations();
          // Check stage completion after a delay
          loadStages().then(() => {
            const justCompleted = stages.value.find(s =>
              s.pointCount > 0 && s.completedCount >= s.pointCount,
            );
            if (justCompleted) {
              setTimeout(() => {
                triggerCelebration('stage', `恭喜！你已完成「${justCompleted.name}」阶段！`);
              }, 2500);
            }
          });
        }
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
        const response = await fetch(`${baseUrl}/points/${pointId}/teaching`, {
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
                teaching.value = data.teaching;
              } else if (data.type === 'chunk') {
                if (data.section) {
                  const section = data.section as TeachingSection;
                  streamingSections.value = {
                    ...streamingSections.value,
                    [section]: streamingSections.value[section] + data.content,
                  };
                } else {
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

      // Post-generation: load quizzes and guidance after stream is fully consumed
      if (teaching.value) {
        generateQuizzes(pointId);
        await loadGuidance(pointId);
      }
    }

    // ===== 聊天 =====
    async function loadChats(pointId: number) {
      await fetchTo(chatLoading, chats,
        () => $fetch<SmChat[]>(`${baseUrl}/points/${pointId}/chats`), []);
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
        const res = await $fetch<ChatResponse>(`${baseUrl}/points/${pointId}/chat`, {
          method: 'POST',
          body: { message: message.trim() },
        });
        chats.value = [
          ...chats.value.filter(m => m.id !== tempMsg.id),
          res.userMessage,
          res.assistantMessage,
        ];
      } catch (e: unknown) {
        chats.value = chats.value.filter(m => m.id !== tempMsg.id);
        chatError.value = extractErrorMessage(e, 'AI 回复失败');
      } finally {
        chatSending.value = false;
      }
    }

    async function clearChats(pointId: number) {
      try {
        await $fetch(`${baseUrl}/points/${pointId}/chats`, { method: 'DELETE' });
        chats.value = [];
      } catch {
        // Silently fail
      }
    }

    // ===== 阶段操作 =====
    async function loadStages() {
      await fetchTo(stagesLoading, stages,
        () => $fetch<StageWithStats[]>(`${baseUrl}/stages`), []);
    }

    async function loadStage(id: number) {
      await fetchTo(stageLoading, currentStage,
        () => $fetch<StageDetail>(`${baseUrl}/stages/${id}`), null);
    }

    // ===== 实践任务操作 =====
    async function loadTasks(pointId: number) {
      await fetchTo(tasksLoading, tasks,
        () => $fetch<SmTask[]>(`${baseUrl}/points/${pointId}/tasks`), []);
    }

    async function generateTasks(pointId: number) {
      tasksGenerating.value = true;
      try {
        const generated = await $fetch<SmTask[]>(`${baseUrl}/points/${pointId}/tasks/generate`, {
          method: 'POST',
        });
        tasks.value = generated;
      } finally {
        tasksGenerating.value = false;
      }
    }

    async function updateTask(taskId: number, data: { isCompleted: boolean; completionNote?: string }) {
      const idx = tasks.value.findIndex(t => t.id === taskId);
      if (idx === -1) return;

      // Optimistic update
      const oldTask = tasks.value[idx];
      const updated = { ...oldTask, ...data, updatedAt: Date.now() };
      tasks.value = tasks.value.map(t => t.id === taskId ? updated : t);

      try {
        const result = await $fetch<SmTask>(`${baseUrl}/tasks/${taskId}`, {
          method: 'PATCH',
          body: data,
        });
        tasks.value = tasks.value.map(t => t.id === taskId ? result : t);
      } catch {
        // Rollback
        tasks.value = tasks.value.map(t => t.id === taskId ? oldTask : t);
      }
    }

    // ===== 笔记操作 =====
    async function loadNote(pointId: number, productId?: number) {
      try {
        const params: Record<string, any> = {};
        if (productId) params.productId = productId;
        note.value = await $fetch<SmNote | null>(`${baseUrl}/points/${pointId}/notes`, { params });
      } catch {
        note.value = null;
      }
    }

    async function saveNote(pointId: number, content: string, productId?: number) {
      noteSaving.value = true;
      try {
        const body: Record<string, any> = { content };
        if (productId) body.productId = productId;
        note.value = await $fetch<SmNote>(`${baseUrl}/points/${pointId}/notes`, {
          method: 'PUT',
          body,
        });
        noteLastSaved.value = Date.now();
      } finally {
        noteSaving.value = false;
      }
    }

    // ===== 学习建议 =====
    async function loadRecommendations() {
      await fetchTo(recommendationsLoading, recommendations,
        async () => (await $fetch<{ recommendations: RecommendedPoint[] }>(`${baseUrl}/recommendations`)).recommendations, []);
    }

    // ===== 增强统计 =====
    async function loadEnhancedStats() {
      try {
        enhancedStats.value = await $fetch<EnhancedGlobalStats>(`${baseUrl}/stats/overview`);
      } catch { enhancedStats.value = null; }
    }

    async function loadDomainStats() {
      try {
        domainStats.value = (await $fetch<{ domains: DomainStatItem[] }>(`${baseUrl}/stats/by-domain`)).domains;
      } catch { domainStats.value = []; }
    }

    // ===== 文章关联操作 =====
    async function loadPointArticles(pointId: number) {
      await fetchTo(linkedArticlesLoading, linkedArticles,
        () => $fetch<LinkedArticle[]>(`${baseUrl}/points/${pointId}/articles`), []);
    }

    async function linkArticles(pointId: number, articleIds: number[]) {
      if (articleIds.length === 0) return;
      await $fetch(`${baseUrl}/points/${pointId}/articles`, {
        method: 'POST',
        body: { articleIds },
      });
      await loadPointArticles(pointId);
    }

    async function unlinkArticle(pointId: number, articleId: number) {
      // Optimistic removal
      const old = linkedArticles.value;
      linkedArticles.value = linkedArticles.value.filter(a => a.articleId !== articleId);
      try {
        await $fetch(`${baseUrl}/points/${pointId}/articles/${articleId}`, {
          method: 'DELETE',
        });
      } catch {
        linkedArticles.value = old;
      }
    }

    // ===== 热力图 + 连续天数 =====
    async function loadHeatmap(year?: number) {
      if (year !== undefined) heatmapYear.value = year;
      try {
        heatmapData.value = await $fetch<Record<string, number>>(`${baseUrl}/stats/heatmap`, {
          params: { year: heatmapYear.value },
        });
      } catch { heatmapData.value = {}; }
    }

    async function loadStreak() {
      try {
        currentStreak.value = (await $fetch<{ streak: number }>(`${baseUrl}/stats/streak`)).streak;
      } catch { currentStreak.value = 0; }
    }

    // ===== 学习记录操作 =====
    async function logActivity(pointId: number, type: ActivityType) {
      try {
        await $fetch(`${baseUrl}/activities`, {
          method: 'POST',
          body: { pointId, type },
        });
      } catch {
        // Silent — activity logging should not block user actions
      }
    }

    async function loadActivities(page = 1, date?: string) {
      activitiesLoading.value = true;
      try {
        const params: Record<string, any> = { page, pageSize: 20 };
        if (date) params.date = date;
        const res = await $fetch<ActivitiesPage>(`${baseUrl}/activities`, { params });
        activities.value = res.items;
        activitiesPage.value = res.page;
        activitiesTotalPages.value = res.totalPages;
      } catch { activities.value = []; }
      finally { activitiesLoading.value = false; }
    }

    // ===== 理解测验操作 =====
    async function loadQuizzes(pointId: number) {
      quizzesLoading.value = true;
      try {
        const data = await $fetch<SmQuizWithAttempt[]>(`${baseUrl}/points/${pointId}/quizzes`);
        if (data.length === 0) {
          // No quizzes yet — auto-generate
          quizzesLoading.value = false;
          generateQuizzes(pointId);
          return;
        }
        quizzes.value = data;
      } catch {
        quizzes.value = [];
      } finally {
        quizzesLoading.value = false;
      }
    }

    async function generateQuizzes(pointId: number) {
      quizzesGenerating.value = true;
      try {
        const data = await $fetch<SmQuizWithAttempt[]>(`${baseUrl}/points/${pointId}/quizzes/generate`, {
          method: 'POST',
        });
        quizzes.value = data.map(q => ({ ...q, passed: false }));
      } catch {
        // Silent — quiz generation is non-critical
      } finally {
        quizzesGenerating.value = false;
      }
    }

    async function submitQuizAnswer(pointId: number, quizId: number, answer: string): Promise<{ isCorrect: boolean; explanation: string | null }> {
      try {
        const res = await $fetch<{ isCorrect: boolean; correctAnswer: string; explanation: string | null }>(
          `${baseUrl}/points/${pointId}/quizzes/${quizId}/answer`,
          { method: 'POST', body: { answer } },
        );

        if (res.isCorrect) {
          quizzes.value = quizzes.value.map(q =>
            q.id === quizId ? { ...q, passed: true } : q,
          );
          logActivity(pointId, 'quiz');
        }

        return { isCorrect: res.isCorrect, explanation: res.explanation };
      } catch {
        return { isCorrect: false, explanation: null };
      }
    }

    // ===== AI 引导操作 =====
    async function loadGuidance(pointId: number) {
      guidanceLoading.value = true;
      try {
        guidance.value = await $fetch<GuidanceResponse>(`${baseUrl}/points/${pointId}/guidance`, {
          method: 'POST',
        });
      } catch {
        guidance.value = null;
      } finally {
        guidanceLoading.value = false;
      }
    }

    // ===== 完成庆祝 =====
    function triggerCelebration(type: 'point' | 'stage', message: string) {
      celebrationType.value = type;
      celebrationMessage.value = message;
      showCelebration.value = true;
    }

    function dismissCelebration() {
      showCelebration.value = false;
    }

    return {
      // 视图状态
      currentView, globalTab, currentDomainId, currentPointId,
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
      // 统计
      globalStats,
      // 面包屑
      breadcrumbDomainName, breadcrumbPointName,
      // 导航
      navigateToGlobal, navigateToDomain, navigateToPoint, switchGlobalTab,
      // 种子数据
      seeding, seedData,
      // 领域操作
      loadDomains, loadDomain,
      // 知识点操作
      loadPoint, updatePointStatus,
      // 教学内容
      generateTeaching,
      // 聊天操作
      loadChats, sendChat, clearChats,
      // 阶段
      stages, stagesLoading, currentStage, stageLoading,
      loadStages, loadStage,
      // 实践任务
      tasks, tasksLoading, tasksGenerating,
      loadTasks, generateTasks, updateTask,
      // 笔记
      note, noteSaving, noteLastSaved,
      loadNote, saveNote,
      // 学习建议
      recommendations, recommendationsLoading,
      loadRecommendations,
      // 增强统计
      enhancedStats, domainStats,
      loadEnhancedStats, loadDomainStats,
      // 文章关联
      linkedArticles, linkedArticlesLoading,
      loadPointArticles, linkArticles, unlinkArticle,
      // 热力图 + 连续天数
      heatmapData, heatmapYear, currentStreak,
      loadHeatmap, loadStreak,
      // 学习记录
      activities, activitiesLoading, activitiesPage, activitiesTotalPages,
      logActivity, loadActivities,
      // 理解测验
      quizzes, quizzesLoading, quizzesGenerating,
      loadQuizzes, generateQuizzes, submitQuizAnswer,
      // AI 引导
      guidance, guidanceLoading, loadGuidance,
      // 完成庆祝
      showCelebration, celebrationType, celebrationMessage,
      triggerCelebration, dismissCelebration,
    };
  });
}

// ===== Store type & InjectionKey =====

export type SkillLearningStore = ReturnType<ReturnType<typeof createSkillLearningStore>>;

export const SKILL_STORE_KEY: InjectionKey<SkillLearningStore> = Symbol('skillStore');
